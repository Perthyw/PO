begin;

-- Extend only metadata. Existing PO rows and their original item JSON stay intact.
alter table public.purchase_orders add column approval_note text;
alter table public.purchase_orders drop constraint purchase_orders_base_cents_check;
alter table public.purchase_orders add constraint purchase_orders_base_cents_check
  check(base_cents>0 or (base_cents=0 and tax_cents=0 and total_cents=0 and status='rejected'));
alter table public.po_items
  add column decision text check (decision is null or decision in ('approved','rejected')),
  add column decision_reason text,
  add column decision_at timestamptz,
  add column decision_by uuid references public.profiles(id);

alter table public.po_events drop constraint po_events_action_check;
alter table public.po_events add constraint po_events_action_check
  check (action in ('create','approve','reject','receive','close','owner_edit'));
alter table public.po_events
  add column before_items jsonb,
  add column after_items jsonb,
  add column before_total_cents bigint,
  add column after_total_cents bigint,
  add column item_amount_delta_cents bigint,
  add column amount_delta_cents bigint,
  add column rejected_line_nos smallint[],
  add column approval_note text;

alter table public.notifications drop constraint notifications_action_check;
alter table public.notifications add constraint notifications_action_check
  check (action in ('create','approve','reject','receive','close','owner_edit'));
alter table public.notifications drop constraint notifications_recipient_id_po_id_action_key;
alter table public.notifications add column event_key text;
create unique index notifications_lifecycle_once
  on public.notifications(recipient_id,po_id,action) where action <> 'owner_edit';
create unique index notifications_event_once
  on public.notifications(recipient_id,event_key) where event_key is not null;

-- This lease is intentionally private and is excluded from user PO backups.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.po_owner_edit_locks (
  po_id uuid primary key references public.purchase_orders(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  token uuid not null unique,
  version integer not null,
  request_id uuid not null,
  expires_at timestamptz not null
);
alter table private.po_owner_edit_locks enable row level security;
revoke all on private.po_owner_edit_locks from public,anon,authenticated;
create index po_events_owner_edit_order on public.po_events(po_id,at,id) where action='owner_edit';

create or replace function public.unlock_po_edit(p_id uuid,p_version integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
        payload jsonb; lease_token uuid; result jsonb;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'owner' then
    raise exception 'เฉพาะเจ้าของที่เปิดใช้งานเท่านั้นที่แก้ไข PO ได้';
  end if;
  if p_id is null or p_version is null or p_request_id is null then raise exception 'คำขอไม่ครบถ้วน'; end if;
  payload=jsonb_build_object('action','unlock_po_edit','id',p_id,'version',p_version);
  perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
  select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
  if found then
    if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if;
    select token into lease_token from private.po_owner_edit_locks
      where po_id=p_id and actor_id=a.id and version=p_version and request_id=p_request_id and expires_at>now();
    if lease_token is null then raise exception 'รายการถูกล็อกหรือหมดเวลาปลดล็อก กรุณาปลดล็อกใหม่'; end if;
    return jsonb_build_object('token',lease_token,'version',p_version);
  end if;
  select * into p from public.purchase_orders where id=p_id for update;
  if not found then raise exception 'ไม่พบใบ PO'; end if;
  if p.version<>p_version then raise exception 'ข้อมูลใบ PO เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด'; end if;
  if p.status not in ('pending','approved','received') then raise exception 'ใบ PO นี้แก้ไขไม่ได้'; end if;
  if not exists(select 1 from public.po_items where po_id=p.id and coalesce(decision,'approved')<>'rejected') then
    raise exception 'ไม่มีรายการที่แก้ไขได้';
  end if;
  lease_token=gen_random_uuid();
  insert into private.po_owner_edit_locks(po_id,actor_id,token,version,request_id,expires_at)
  values(p.id,a.id,lease_token,p.version,p_request_id,now()+interval '10 minutes')
  on conflict(po_id) do update set actor_id=excluded.actor_id,token=excluded.token,
    version=excluded.version,request_id=excluded.request_id,expires_at=excluded.expires_at;
  result=jsonb_build_object('token',lease_token,'version',p.version);
  insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,jsonb_build_object('version',p.version));
  return result;
end $$;

create or replace function public.lock_po_edit(p_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=''
as $$
declare a public.profiles%rowtype;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'owner' then
    raise exception 'เฉพาะเจ้าของที่เปิดใช้งานเท่านั้นที่แก้ไข PO ได้';
  end if;
  if p_id is null or p_token is null then return false; end if;
  delete from private.po_owner_edit_locks where po_id=p_id and actor_id=a.id and token=p_token;
  return found;
end $$;

create or replace function public.edit_po_items(p_id uuid,p_version integer,p_token uuid,p_items jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
  lease private.po_owner_edit_locks%rowtype; payload jsonb; result jsonb;
  old_item jsonb; input_item jsonb; next_item jsonb; before_items jsonb='[]'; after_items jsonb='[]';
  v_line_no integer; input_pos integer=0; editable_count integer=0; line_count integer=0;
  v_department_name text; v_payment_method text; v_department_id uuid;
  v_quantity numeric; v_unit_price numeric; v_line_total bigint; v_line_base bigint; v_line_tax bigint;
  sum_base bigint=0; sum_tax bigint=0; sum_total bigint=0; before_total bigint=0;
  changed_total bigint; now_at timestamptz=now(); changed_rows integer;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'owner' then
    raise exception 'เฉพาะเจ้าของที่เปิดใช้งานเท่านั้นที่แก้ไข PO ได้';
  end if;
  if p_id is null or p_version is null or p_token is null or p_request_id is null then raise exception 'คำขอไม่ครบถ้วน'; end if;
  payload=jsonb_build_object('action','edit_po_items','id',p_id,'version',p_version,
    'token_fingerprint',md5(p_token::text),'items',p_items);
  perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
  select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
  if found then
    if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if;
    return c.result;
  end if;
  select * into p from public.purchase_orders where id=p_id for update;
  if not found then raise exception 'ไม่พบใบ PO'; end if;
  if p.version<>p_version then raise exception 'ข้อมูลใบ PO เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด'; end if;
  if p.status not in ('pending','approved','received') then raise exception 'ใบ PO นี้แก้ไขไม่ได้'; end if;
  select * into lease from private.po_owner_edit_locks
    where po_id=p.id and actor_id=a.id and token=p_token and version=p.version and expires_at>now_at for update;
  if not found then raise exception 'รายการถูกล็อกหรือหมดเวลาปลดล็อก กรุณาปลดล็อกใหม่'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ข้อมูลรายการไม่ถูกต้อง'; end if;
  select count(*) into line_count from public.po_items where po_id=p.id;
  select count(*) into editable_count from public.po_items where po_id=p.id and coalesce(decision,'approved')<>'rejected';
  if jsonb_array_length(p_items)<>editable_count or editable_count=0 then
    raise exception 'แก้ไขได้เฉพาะรายการที่ยังดำเนินการ และห้ามเพิ่มหรือลบรายการ';
  end if;
  if line_count<>(select jsonb_array_length(p.items)) then raise exception 'รายการ PO ไม่ตรงกับข้อมูลต้นฉบับ'; end if;
  for old_item,v_line_no in
    select x.value,(x.ordinality)::integer from jsonb_array_elements(p.items) with ordinality x(value,ordinality)
  loop
    if coalesce(old_item->>'decision','approved')='rejected' then
      next_item=old_item||jsonb_build_object('line_no',v_line_no);
    else
      input_pos=input_pos+1; input_item=p_items->(input_pos-1);
      if (input_item->>'line_no')::integer is distinct from v_line_no then
        raise exception 'ลำดับรายการเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด';
      end if;
      if input_item ?| array['id','item_id','order','decision','decision_reason','decision_at','decision_by'] then
        raise exception 'แก้ไขรหัส ลำดับ หรือผลอนุมัติของรายการไม่ได้';
      end if;
      v_department_name=btrim(coalesce(input_item->>'department',''));
      if v_department_name='' or length(v_department_name)>100 then raise exception 'ระบุแผนก/สาขาให้ถูกต้อง'; end if;
      if v_department_name=coalesce(old_item->>'department','') then
        select d.id into v_department_id from public.departments d where d.name=v_department_name;
      else
        select d.id into v_department_id from public.departments d where d.name=v_department_name and d.archived_at is null;
      end if;
      if v_department_id is null then raise exception 'เลือกแผนก/สาขาที่เปิดใช้งาน'; end if;
      if length(btrim(coalesce(input_item->>'name',''))) not between 1 and 200
        or length(btrim(coalesce(input_item->>'spec',''))) not between 1 and 2000
        or length(btrim(coalesce(input_item->>'source',''))) not between 1 and 300
        or length(btrim(coalesce(input_item->>'unit',''))) not between 1 and 50
        or length(coalesce(input_item->>'note',''))>2000 then raise exception 'ตรวจชื่อสินค้า แผนก สเปค แหล่งซื้อ หน่วย และหมายเหตุ'; end if;
      if coalesce(input_item->>'qty','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$'
        or coalesce(input_item->>'unit_price','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
        or jsonb_typeof(input_item->'vat') is distinct from 'boolean' then raise exception 'จำนวน ราคา หรือ VAT ไม่ถูกต้อง'; end if;
      v_quantity=(input_item->>'qty')::numeric; v_unit_price=(input_item->>'unit_price')::numeric;
      if v_quantity<=0 or v_quantity>1000000 or v_unit_price<=0 or v_unit_price>1000000000 then raise exception 'จำนวนหรือราคาอยู่นอกช่วงที่รองรับ'; end if;
      v_line_total=round(v_quantity*v_unit_price*100)::bigint;
      if v_line_total<=0 or v_line_total>100000000000 then raise exception 'ยอดต่อรายการอยู่นอกช่วงที่รองรับ'; end if;
      v_line_base=case when (input_item->>'vat')::boolean then round(v_line_total*100.0/107.0)::bigint else v_line_total end;
      v_line_tax=v_line_total-v_line_base;
      v_payment_method=coalesce(input_item->>'payment_method',old_item->>'payment_method');
      if v_payment_method='' then v_payment_method=nullif(old_item->>'payment_method',''); end if;
      if v_payment_method is not null and v_payment_method not in ('cash','credit') then raise exception 'วิธีชำระเงินต้องเป็นเครดิตหรือเงินสด'; end if;
      next_item=(old_item-'line_no'-'department'-'name'-'spec'-'source'-'note'-'qty'-'unit'-'unit_price'-'vat'-'base_cents'-'tax_cents'-'total_cents'-'payment_method')
        ||jsonb_build_object('line_no',v_line_no,'department',v_department_name,'name',btrim(input_item->>'name'),
          'spec',btrim(input_item->>'spec'),'source',btrim(input_item->>'source'),'note',coalesce(input_item->>'note',''),
          'qty',v_quantity::text,'unit',btrim(input_item->>'unit'),'unit_price',v_unit_price::text,
          'vat',(input_item->>'vat')::boolean,'base_cents',v_line_base,'tax_cents',v_line_tax,'total_cents',v_line_total);
      if old_item ? 'payment_method' or v_payment_method is not null then
        next_item=next_item||jsonb_build_object('payment_method',v_payment_method);
      end if;
      before_total=before_total+coalesce((old_item->>'total_cents')::bigint,0);
      sum_base=sum_base+v_line_base; sum_tax=sum_tax+v_line_tax; sum_total=sum_total+v_line_total;
      update public.po_items i set department_id=v_department_id,name=btrim(input_item->>'name'),
        spec=btrim(input_item->>'spec'),source=btrim(input_item->>'source'),note=coalesce(input_item->>'note',''),
        qty=v_quantity,unit=btrim(input_item->>'unit'),unit_price=v_unit_price,vat=(input_item->>'vat')::boolean,
        base_cents=v_line_base,tax_cents=v_line_tax,total_cents=v_line_total,payment_method=v_payment_method
        where i.po_id=p.id and i.line_no=v_line_no;
      get diagnostics changed_rows=row_count;
      if changed_rows<>1 then raise exception 'รายการ PO ไม่ตรงกับข้อมูลต้นฉบับ'; end if;
    end if;
    before_items=before_items||jsonb_build_array(old_item||jsonb_build_object('line_no',v_line_no));
    after_items=after_items||jsonb_build_array(next_item);
  end loop;
  if sum_base<=0 or sum_total<>sum_base+sum_tax then raise exception 'ยอดรวมรายการไม่ถูกต้อง'; end if;
  if before_items=after_items then
    delete from private.po_owner_edit_locks where po_id=p.id and token=p_token;
    result=to_jsonb(p);
    insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,result);
    return result;
  end if;
  changed_total=sum_total-before_total;
  update public.purchase_orders set items=after_items,base_cents=sum_base,tax_cents=sum_tax,total_cents=sum_total,
    department=case when (select count(distinct value->>'department') from jsonb_array_elements(after_items))=1 then after_items->0->>'department' else 'หลายแผนก/สาขา' end,
    version=version+1 where id=p.id returning * into p;
  insert into public.po_events(po_id,actor_id,actor_name,action,at,before_items,after_items,
    before_total_cents,after_total_cents,item_amount_delta_cents,amount_delta_cents)
  values(p.id,a.id,a.display_name,'owner_edit',now_at,before_items,after_items,before_total,sum_total,changed_total,changed_total);
  insert into public.notifications(recipient_id,po_id,action,title,message,event_key)
  values(p.created_by,p.id,'owner_edit','เจ้าของแก้ไขรายการในใบ PO',p.po_number||' มีการแก้ไขรายการโดยเจ้าของ',p.id::text||':owner_edit:'||p.version::text)
  on conflict do nothing;
  delete from private.po_owner_edit_locks where po_id=p.id and token=p_token;
  result=to_jsonb(p);
  insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,result);
  return result;
end $$;

create or replace function public.decide_po_items(
  p_id uuid,p_version integer,p_rejected_line_nos smallint[],p_reason text,p_approval_note text,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
  payload jsonb; result jsonb; reason text=btrim(coalesce(p_reason,'')); clean_note text=btrim(coalesce(p_approval_note,''));
  rejected smallint[]; line_count integer; rejected_count integer; next_items jsonb='[]'; before_items jsonb; item jsonb;
  v_line_no integer; v_rejected boolean; at_time timestamptz=now(); sum_base bigint=0; sum_tax bigint=0; sum_total bigint=0;
  before_total bigint; action_name text; next_status text;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'owner' then raise exception 'เฉพาะเจ้าของที่เปิดใช้งานเท่านั้นที่อนุมัติ PO ได้'; end if;
  if p_id is null or p_version is null or p_request_id is null then raise exception 'คำขอไม่ครบถ้วน'; end if;
  if length(reason)>2000 or length(clean_note)>2000 then raise exception 'ข้อความต้องไม่เกิน 2,000 ตัวอักษร'; end if;
  if array_position(coalesce(p_rejected_line_nos,'{}'::smallint[]),null) is not null then raise exception 'รายการสินค้าที่เลือกไม่ถูกต้อง'; end if;
  select coalesce(array_agg(distinct n order by n),'{}'::smallint[]) into rejected
    from unnest(coalesce(p_rejected_line_nos,'{}'::smallint[])) n;
  payload=jsonb_build_object('action','decide_po_items','id',p_id,'version',p_version,
    'rejected_line_nos',rejected,'reason',reason,'approval_note',clean_note);
  perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
  select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
  if found then
    if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if;
    return c.result;
  end if;
  select * into p from public.purchase_orders where id=p_id for update;
  if not found then raise exception 'ไม่พบใบ PO'; end if;
  if p.version<>p_version then raise exception 'ข้อมูลใบ PO เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด'; end if;
  if p.status<>'pending' then raise exception 'พิจารณาได้เฉพาะใบ PO ที่รออนุมัติ'; end if;
  before_items=(select coalesce(jsonb_agg(x.value||jsonb_build_object('line_no',x.ordinality) order by x.ordinality),'[]'::jsonb)
    from jsonb_array_elements(p.items) with ordinality x(value,ordinality));
  select count(*) into line_count from public.po_items where po_id=p.id;
  if cardinality(rejected)>line_count or exists(select 1 from unnest(rejected) n where n<1 or n>line_count) then
    raise exception 'รายการสินค้าที่เลือกไม่ถูกต้อง';
  end if;
  if cardinality(rejected)>0 and reason='' then raise exception 'ระบุเหตุผลของรายการที่ไม่อนุมัติ'; end if;
  rejected_count=cardinality(rejected);
  next_status=case when line_count>0 and rejected_count=line_count then 'rejected' else 'approved' end;
  action_name=case when next_status='rejected' then 'reject' else 'approve' end;
  if next_status='rejected' then clean_note=''; end if;
  before_total=p.total_cents;
  for item,v_line_no in
    select x.value,(x.ordinality)::integer from jsonb_array_elements(p.items) with ordinality x(value,ordinality)
  loop
    v_rejected=v_line_no=any(rejected);
    if v_rejected then
      item=item||jsonb_build_object('line_no',v_line_no,'decision','rejected','decision_reason',reason,'decision_at',at_time,'decision_by',a.id);
    else
      item=item||jsonb_build_object('line_no',v_line_no,'decision','approved','decision_reason','','decision_at',at_time,'decision_by',a.id);
      sum_base=sum_base+coalesce((item->>'base_cents')::bigint,0);
      sum_tax=sum_tax+coalesce((item->>'tax_cents')::bigint,0);
      sum_total=sum_total+coalesce((item->>'total_cents')::bigint,0);
    end if;
    update public.po_items i set decision=case when v_rejected then 'rejected' else 'approved' end,
      decision_reason=case when v_rejected then reason else '' end,decision_at=at_time,decision_by=a.id
      where i.po_id=p.id and i.line_no=v_line_no;
    if not found then raise exception 'รายการ PO ไม่ตรงกับข้อมูลต้นฉบับ'; end if;
    next_items=next_items||jsonb_build_array(item);
  end loop;
  update public.purchase_orders set items=next_items,status=next_status,version=version+1,
    approved_at=case when next_status='approved' then at_time else approved_at end,
    rejection_reason=case when next_status='rejected' then reason else null end,
    approval_note=nullif(clean_note,''),base_cents=sum_base,tax_cents=sum_tax,total_cents=sum_total
  where id=p.id returning * into p;
  insert into public.po_events(po_id,actor_id,actor_name,action,at,reason,rejected_line_nos,approval_note,
    before_items,after_items,before_total_cents,after_total_cents,item_amount_delta_cents,amount_delta_cents)
  values(p.id,a.id,a.display_name,action_name,at_time,case when action_name='reject' then reason else '' end,
    rejected,nullif(clean_note,''),null,null,null,null,null,null);
  insert into public.notifications(recipient_id,po_id,action,title,message)
  values(p.created_by,p.id,action_name,
    case when action_name='reject' then 'ใบขอซื้อไม่อนุมัติ' else 'ใบขอซื้อได้รับอนุมัติ' end,
    case when action_name='reject' then p.po_number||' ไม่ได้รับอนุมัติ' else p.po_number||' ได้รับอนุมัติแล้ว' end)
  on conflict do nothing;
  result=to_jsonb(p);
  insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,result);
  return result;
end $$;

create or replace function public.po_counts(p_mine boolean default false) returns jsonb
language sql stable security invoker set search_path=''
as $$
  select jsonb_build_object(
    'pending',count(*) filter(where po.status='pending'),
    'approved',count(*) filter(where po.status='approved'),
    'received',count(*) filter(where po.status='received'),
    'closed',count(*) filter(where po.status='closed'),
    'rejected',count(*) filter(where po.status='rejected' or exists(
      select 1 from public.po_items i where i.po_id=po.id and i.decision='rejected')))
  from public.purchase_orders po where not p_mine or po.created_by=(select auth.uid());
$$;

create or replace function public.list_po(p_status text default null,p_page integer default 1,p_scope text default 'all') returns jsonb
language plpgsql security definer set search_path=''
as $$
declare a public.profiles%rowtype; result jsonb; total_count integer; first_row integer;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role not in ('owner','office') then raise exception 'บัญชีนี้ไม่มีสิทธิ์ดูรายการ PO'; end if;
  if p_status is not null and p_status not in ('pending','approved','received','closed','rejected') then raise exception 'ตัวกรองสถานะไม่ถูกต้อง'; end if;
  if p_page is null or p_page<1 or p_page>100000 or p_scope is null or p_scope not in ('all','mine') then raise exception 'ตัวกรองรายการไม่ถูกต้อง'; end if;
  if p_scope='all' and a.role='office' and not a.can_export_report then raise exception 'บัญชีนี้ดูได้เฉพาะใบ PO ของตนเอง'; end if;
  first_row=(p_page-1)*10;
  with visible as (
    select po.* from public.purchase_orders po
    where (a.role='owner' or (a.role='office' and (a.can_export_report and p_scope='all' or po.created_by=a.id)))
  ), base as (
    select v.*,exists(select 1 from public.po_items i where i.po_id=v.id and i.decision='rejected') as has_rejected
    from visible v
  ), selected as (
    select b.*,case when p_status='rejected' then 'rejected' else b.status end as display_status,
      p_status='rejected' as rejected_projection
    from base b
    where p_status is null
      or (p_status='rejected' and (b.status='rejected' or b.has_rejected))
      or (p_status<>'rejected' and b.status=p_status)
  ), counted as (select count(*)::integer as n from selected), page_rows as (
    select s.* from selected s order by s.po_date desc,s.created_at desc,s.id limit 10 offset first_row
  )
  select counted.n,coalesce(jsonb_agg(
    (to_jsonb(r)-'display_status'-'rejected_projection'-'has_rejected')||jsonb_build_object(
      'status',r.display_status,
      'items',coalesce((select jsonb_agg(x.value||jsonb_build_object('line_no',x.ordinality) order by x.ordinality)
        from jsonb_array_elements(r.items) with ordinality x(value,ordinality)
        where case when r.rejected_projection then
          (x.value->>'decision')='rejected' or r.status='rejected' and not exists
            (select 1 from jsonb_array_elements(r.items) q(value) where q.value ? 'decision')
          else coalesce(x.value->>'decision','approved')<>'rejected' end),'[]'::jsonb),
      'base_cents',coalesce((select sum((x.value->>'base_cents')::bigint) from jsonb_array_elements(r.items) x(value)
        where case when r.rejected_projection then
          (x.value->>'decision')='rejected' or r.status='rejected' and not exists
            (select 1 from jsonb_array_elements(r.items) q(value) where q.value ? 'decision')
          else coalesce(x.value->>'decision','approved')<>'rejected' end),0),
      'tax_cents',coalesce((select sum((x.value->>'tax_cents')::bigint) from jsonb_array_elements(r.items) x(value)
        where case when r.rejected_projection then
          (x.value->>'decision')='rejected' or r.status='rejected' and not exists
            (select 1 from jsonb_array_elements(r.items) q(value) where q.value ? 'decision')
          else coalesce(x.value->>'decision','approved')<>'rejected' end),0),
      'total_cents',coalesce((select sum((x.value->>'total_cents')::bigint) from jsonb_array_elements(r.items) x(value)
        where case when r.rejected_projection then
          (x.value->>'decision')='rejected' or r.status='rejected' and not exists
            (select 1 from jsonb_array_elements(r.items) q(value) where q.value ? 'decision')
          else coalesce(x.value->>'decision','approved')<>'rejected' end),0),
      'real_status',case when r.rejected_projection then r.status else null end
    ) order by r.po_date desc,r.created_at desc,r.id) filter(where r.id is not null),'[]'::jsonb)
  into total_count,result from counted left join page_rows r on true group by counted.n;
  return jsonb_build_object('rows',result,'total',coalesce(total_count,0));
end $$;

create or replace function public.monthly_po_report(p_month date) returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare result jsonb; a public.profiles%rowtype;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'office' or not a.can_export_report then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์ดูรายงานรวม';
  end if;
  if p_month is null then raise exception 'ระบุเดือนรายงาน'; end if;
  with selected as (
    select po.* from public.purchase_orders po where po.po_date>=date_trunc('month',p_month)::date
      and po.po_date<(date_trunc('month',p_month)+interval '1 month')::date
  ), report_rows as (
    select s.*,
      coalesce((select jsonb_agg(x.value||jsonb_build_object('line_no',x.ordinality) order by x.ordinality)
        from jsonb_array_elements(s.items) with ordinality x(value,ordinality)
        where coalesce(x.value->>'decision','approved')<>'rejected'
          and not (s.status='rejected' and not exists(select 1 from jsonb_array_elements(s.items) q(value) where q.value ? 'decision'))),'[]'::jsonb) accepted_items,
      coalesce((select jsonb_agg(to_jsonb(e) order by e.at,e.id) from public.po_events e where e.po_id=s.id and e.action='owner_edit'),'[]'::jsonb) history,
      exists(select 1 from public.po_items i where i.po_id=s.id and i.decision='rejected') as has_rejected
    from selected s
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg((to_jsonb(r)-'accepted_items'-'history'-'has_rejected')||jsonb_build_object(
      'items',r.accepted_items,'edit_history',r.history,
      'base_cents',coalesce((select sum((x.value->>'base_cents')::bigint) from jsonb_array_elements(r.accepted_items) x(value)),0),
      'tax_cents',coalesce((select sum((x.value->>'tax_cents')::bigint) from jsonb_array_elements(r.accepted_items) x(value)),0),
      'total_cents',coalesce((select sum((x.value->>'total_cents')::bigint) from jsonb_array_elements(r.accepted_items) x(value)),0)
    ) order by r.po_date desc,r.created_at desc) from report_rows r),'[]'::jsonb),
    'total_cents',coalesce((select sum((x.value->>'total_cents')::bigint) from report_rows r cross join jsonb_array_elements(r.accepted_items) x(value) where r.status in ('approved','received','closed')),0),
    'ordered_count',(select count(*) from selected where status in ('approved','received','closed')),
    'pending_count',(select count(*) from selected where status='pending'),
    'rejected_count',(select count(*) from report_rows where has_rejected or status='rejected')
  ) into result;
  return result;
end $$;

revoke all on function public.unlock_po_edit(uuid,integer,uuid),public.lock_po_edit(uuid,uuid),
  public.edit_po_items(uuid,integer,uuid,jsonb,uuid),
  public.decide_po_items(uuid,integer,smallint[],text,text,uuid),public.list_po(text,integer,text) from public,anon;
grant execute on function public.unlock_po_edit(uuid,integer,uuid),public.lock_po_edit(uuid,uuid),
  public.edit_po_items(uuid,integer,uuid,jsonb,uuid),
  public.decide_po_items(uuid,integer,smallint[],text,text,uuid),public.list_po(text,integer,text) to authenticated;
revoke all on function public.po_counts(boolean),public.monthly_po_report(date) from public,anon;
grant execute on function public.po_counts(boolean),public.monthly_po_report(date) to authenticated;


create or replace function public.create_po(p_items jsonb,p_po_date date,p_request_id uuid,p_department text default 'ออฟฟิศ')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
  i jsonb; normalized jsonb='[]'; payload jsonb; q numeric; unit_price numeric;
  base bigint; total bigint; sum_base bigint=0; sum_total bigint=0; vat boolean;
  item_name text; spec text; purchase_source text; note text; item_unit text; item_department text; department_id uuid;
  payment_method text;
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null or a.role<>'office' then raise exception 'เฉพาะออฟฟิศที่ได้รับสิทธิ์เท่านั้นที่เปิด PO ได้'; end if;
  if p_request_id is null then raise exception 'ไม่พบหมายเลขคำขอ'; end if;
  if p_po_date is null or p_po_date<'2000-01-01' or p_po_date>'2099-12-31' then raise exception 'วันที่ใบ PO ไม่ถูกต้อง'; end if;
  payload=jsonb_build_object('action','create','po_date',p_po_date,'items',p_items,'department',p_department);
  perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
  select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
  if found then if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if; return c.result; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'ระบุสินค้า 1–50 รายการ'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    item_name=btrim(coalesce(i->>'name','')); spec=btrim(coalesce(i->>'spec',''));
    purchase_source=btrim(coalesce(i->>'source','')); note=btrim(coalesce(i->>'note',''));
    item_unit=btrim(coalesce(i->>'unit','')); item_department=btrim(coalesce(i->>'department',p_department,''));
    select d.id into department_id from public.departments d where d.name=item_department and d.archived_at is null;
    if department_id is null then raise exception 'เลือกแผนก/สาขาที่มีในระบบสำหรับทุกรายการ'; end if;
    if length(item_name) not between 1 and 200 or length(spec) not between 1 and 2000 then raise exception 'ระบุชื่อสินค้าและสเปคให้ครบ'; end if;
    if length(purchase_source) not between 1 and 300 or length(note)>2000 then raise exception 'ระบุแหล่งซื้อและตรวจความยาวหมายเหตุ'; end if;
    if length(item_unit) not between 1 and 50 then raise exception 'ระบุหน่วยไม่เกิน 50 ตัวอักษร'; end if;
    if i ? 'payment_method' and jsonb_typeof(i->'payment_method') not in ('string','null') then raise exception 'วิธีชำระเงินต้องเป็นเครดิตหรือเงินสด'; end if;
    payment_method=nullif(i->>'payment_method','');
    if payment_method is not null and payment_method not in ('credit','cash') then raise exception 'วิธีชำระเงินต้องเป็นเครดิตหรือเงินสด'; end if;
    if coalesce(i->>'qty','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' or coalesce(i->>'unit_price','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'จำนวนหรือราคาไม่ถูกต้อง'; end if;
    if jsonb_typeof(i->'vat') is distinct from 'boolean' then raise exception 'ระบุ VAT หรือ NON VAT'; end if;
    q=(i->>'qty')::numeric; unit_price=(i->>'unit_price')::numeric; vat=(i->>'vat')::boolean;
    if q<=0 or q>1000000 or unit_price<=0 or unit_price>1000000000 then raise exception 'จำนวนหรือราคาอยู่นอกช่วงที่รองรับ'; end if;
    total=round(q*unit_price*100); base=case when vat then round(total*100.0/107.0) else total end;
    if total>100000000000 or base<=0 then raise exception 'ยอดต่อรายการต้องอยู่ระหว่าง 0.01 ถึง 1,000,000,000 บาท'; end if;
    normalized=normalized||jsonb_build_array(jsonb_build_object('department',item_department,'payment_method',payment_method,
      'name',item_name,'spec',spec,'source',purchase_source,'note',note,'qty',q::text,'unit',item_unit,'unit_price',unit_price::text,
      'vat',vat,'base_cents',base,'tax_cents',total-base,'total_cents',total));
    sum_base=sum_base+base; sum_total=sum_total+total;
  end loop;
  insert into public.purchase_orders(po_number,po_date,created_by,requester_name,department,items,base_cents,tax_cents,total_cents)
  values('PO-'||to_char(p_po_date,'YYYY')||'-'||lpad(nextval('public.po_number_seq')::text,6,'0'),p_po_date,a.id,a.display_name,
    case when (select count(distinct value->>'department') from jsonb_array_elements(normalized))=1 then normalized->0->>'department' else 'หลายแผนก/สาขา' end,
    normalized,sum_base,sum_total-sum_base,sum_total) returning * into p;
  insert into public.po_items(po_id,line_no,department_id,name,spec,source,note,qty,unit,unit_price,vat,base_cents,tax_cents,total_cents,payment_method)
  select p.id,ord::smallint,d.id,x.value->>'name',x.value->>'spec',x.value->>'source',x.value->>'note',
    (x.value->>'qty')::numeric,x.value->>'unit',(x.value->>'unit_price')::numeric,(x.value->>'vat')::boolean,
    (x.value->>'base_cents')::bigint,(x.value->>'tax_cents')::bigint,(x.value->>'total_cents')::bigint,x.value->>'payment_method'
  from jsonb_array_elements(normalized) with ordinality x(value,ord) join public.departments d on d.name=x.value->>'department';
  insert into public.po_events(po_id,actor_id,actor_name,action) values(p.id,a.id,a.display_name,'create');
  insert into public.notifications(recipient_id,po_id,action,title,message)
  select id,p.id,'create','มีใบขอซื้อใหม่',a.display_name||' เปิด '||p.po_number from public.profiles where role='owner' and deleted_at is null
  on conflict do nothing;
  insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,to_jsonb(p));
  return to_jsonb(p);
end $$;

create or replace function public.act_on_po(p_id uuid,p_action text,p_version integer,p_reason text,p_invoice_confirmed boolean,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
        payload jsonb; next_status text; reason text=btrim(coalesce(p_reason,''));
begin
  select * into a from public.profiles where id=auth.uid();
  if a.id is null or a.deleted_at is not null then raise exception 'บัญชีนี้ไม่มีสิทธิ์ใช้งาน'; end if;
  if p_request_id is null or p_version is null then raise exception 'คำขอไม่ครบถ้วน'; end if;
  if p_action is null or p_action not in ('approve','reject','receive','close') then raise exception 'คำสั่งไม่ถูกต้อง'; end if;
  if (p_action='receive' and a.role<>'office') or (p_action in ('approve','reject','close') and a.role<>'owner') then raise exception 'บทบาทนี้ไม่มีสิทธิ์ทำรายการ'; end if;
  payload=jsonb_build_object('id',p_id,'action',p_action,'version',p_version,'reason',reason,'invoice',p_invoice_confirmed);
  perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
  select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
  if found then if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if; return c.result; end if;
  select * into p from public.purchase_orders where id=p_id for update;
  if not found then raise exception 'ไม่พบใบ PO'; end if;
  if p_action='receive' and not (a.can_export_report or p.created_by=a.id) then raise exception 'รับสินค้าได้เฉพาะใบ PO ของตนเอง'; end if;
  if p.version<>p_version then raise exception 'สถานะเปลี่ยนแล้ว กรุณากลับรายการและโหลดข้อมูลล่าสุด'; end if;
  if length(reason)>2000 then raise exception 'เหตุผลต้องไม่เกิน 2,000 ตัวอักษร'; end if;
  if p_action in ('approve','reject') and p.status='pending' then
    if p_action='reject' and reason='' then raise exception 'ระบุเหตุผลที่ไม่อนุมัติ'; end if;
    next_status=case when p_action='approve' then 'approved' else 'rejected' end;
  elsif p_action='receive' and p.status='approved' then next_status='received';
  elsif p_action='close' and p.status='received' then
    if p_invoice_confirmed is distinct from true then raise exception 'ต้องยืนยันว่าได้รับใบกำกับภาษีแล้ว'; end if;
    next_status='closed';
  else raise exception 'ไม่สามารถดำเนินการในสถานะนี้ได้'; end if;
  update public.purchase_orders set status=next_status,version=version+1,
    approved_at=case when p_action='approve' then now() else approved_at end,
    rejection_reason=case when p_action='reject' then reason else rejection_reason end,
    invoice_confirmed=case when p_action='close' then true else invoice_confirmed end
    where id=p.id returning * into p;
  insert into public.po_events(po_id,actor_id,actor_name,action,reason) values(p.id,a.id,a.display_name,p_action,reason);
  if a.role='owner' then
    insert into public.notifications(recipient_id,po_id,action,title,message)
    values(p.created_by,p.id,p_action,
      case p_action when 'approve' then 'ใบขอซื้อได้รับอนุมัติ' when 'reject' then 'ใบขอซื้อไม่อนุมัติ' else 'ปิดใบ PO แล้ว' end,
      case p_action when 'approve' then p.po_number||' ได้รับอนุมัติแล้ว' when 'reject' then p.po_number||' ไม่ได้รับอนุมัติ' else p.po_number||' ตรวจรับเอกสารและปิดแล้ว' end)
    on conflict do nothing;
  else
    insert into public.notifications(recipient_id,po_id,action,title,message)
    select id,p.id,p_action,'ได้รับสินค้าแล้ว',a.display_name||' ยืนยันรับสินค้า '||p.po_number
    from public.profiles where role='owner' and deleted_at is null on conflict do nothing;
  end if;
  insert into public.po_commands(actor_id,request_id,payload,result) values(a.id,p_request_id,payload,to_jsonb(p));
  return to_jsonb(p);
end $$;
commit;


