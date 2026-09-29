-- Apply once to a NEW Supabase project dedicated to PO The Grands.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id),
 login_email text not null,
 display_name text not null check (length(btrim(display_name)) between 1 and 100),
 role text not null check (role in ('office','owner')),
 can_export_report boolean not null default false,
 login_name text unique,
 deleted_at timestamptz,
 unique(login_email),
 check(login_email=lower(login_email))
);
create sequence public.po_number_seq;
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(),
 po_number text not null unique,
 po_date date not null default ((now() at time zone 'Asia/Bangkok')::date),
 created_at timestamptz not null default now(),
 approved_at timestamptz,
 created_by uuid not null references public.profiles(id),
 requester_name text not null,
 department text not null check(length(btrim(department)) between 1 and 100),
 status text not null default 'pending' check (status in ('pending','approved','received','closed','rejected')),
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 50),
 base_cents bigint not null check(base_cents>0),
 tax_cents bigint not null check(tax_cents>=0),
 total_cents bigint not null check(total_cents=base_cents+tax_cents),
 version integer not null default 1,
 rejection_reason text,
 invoice_confirmed boolean not null default false,
 check(status<>'closed' or invoice_confirmed),
 check(status<>'rejected' or length(btrim(rejection_reason))>0)
);
create index po_status_date on public.purchase_orders(status,po_date desc,created_at desc);
create index po_date on public.purchase_orders(po_date desc,created_at desc);
create table public.po_events (
 id uuid primary key default gen_random_uuid(),
 po_id uuid not null references public.purchase_orders(id),
 actor_id uuid not null references public.profiles(id),
 actor_name text not null,
 action text not null check(action in ('create','approve','reject','receive','close')),
 at timestamptz not null default now(),
 reason text not null default ''
);
create index po_events_order on public.po_events(po_id,at);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id),
 po_id uuid not null references public.purchase_orders(id),
 action text not null check(action in ('create','approve','reject','receive','close')),
 title text not null,
 message text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,po_id,action)
);
create index notifications_recipient on public.notifications(recipient_id,read_at,created_at desc);
create table public.po_commands (
 actor_id uuid not null references public.profiles(id),
 request_id uuid not null,
 payload jsonb not null,
 result jsonb not null,
 primary key(actor_id,request_id)
);
alter table public.profiles enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_events enable row level security;
alter table public.notifications enable row level security;
alter table public.po_commands enable row level security;
revoke all on public.profiles,public.purchase_orders,public.po_events,public.notifications,public.po_commands from anon,authenticated;
revoke all on sequence public.po_number_seq from anon,authenticated;
grant select on public.profiles,public.purchase_orders,public.po_events,public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy profile_self on public.profiles for select to authenticated using(id=(select auth.uid()) and deleted_at is null);
create policy po_team_read on public.purchase_orders for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.deleted_at is null and (p.role='owner' or p.can_export_report or created_by=(select auth.uid()))));
create policy events_team_read on public.po_events for select to authenticated using(exists(select 1 from public.profiles p join public.purchase_orders po on po.id=po_events.po_id where p.id=(select auth.uid()) and p.deleted_at is null and (p.role='owner' or p.can_export_report or po.created_by=(select auth.uid()))));
create policy notifications_self_read on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy notifications_self_update on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));

create function public.create_po(p_items jsonb,p_po_date date,p_request_id uuid,p_department text default 'ออฟฟิศ') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
 i jsonb; normalized jsonb='[]'; payload jsonb; q numeric; unit_price numeric;
 base bigint; total bigint; sum_base bigint=0; sum_total bigint=0; vat boolean;
 item_name text; spec text; purchase_source text; note text; item_unit text;
begin
 select * into a from public.profiles where id=auth.uid();
 if a.id is null or a.role<>'office' then raise exception 'เฉพาะออฟฟิศที่ได้รับสิทธิ์เท่านั้นที่เปิด PO ได้'; end if;
 if p_request_id is null then raise exception 'ไม่พบหมายเลขคำขอ'; end if;
 if p_po_date is null or p_po_date<'2000-01-01' or p_po_date>'2099-12-31' then raise exception 'วันที่ใบ PO ไม่ถูกต้อง'; end if;
 if length(btrim(coalesce(p_department,''))) not between 1 and 100 then raise exception 'ระบุแผนก/สาขา'; end if;
 payload=jsonb_build_object('action','create','po_date',p_po_date,'items',p_items);
 perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
 select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
 if found then
  if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if;
  return c.result;
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'ระบุรายการสินค้า'; end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'ระบุสินค้า 1–50 รายการ'; end if;
 for i in select value from jsonb_array_elements(p_items) loop
  item_name=btrim(coalesce(i->>'name','')); spec=btrim(coalesce(i->>'spec',''));
  purchase_source=btrim(coalesce(i->>'source','')); note=btrim(coalesce(i->>'note','')); item_unit=btrim(coalesce(i->>'unit',''));
  if length(item_name) not between 1 and 200 or length(spec) not between 1 and 2000 then raise exception 'ระบุชื่อสินค้าและสเปคให้ครบ'; end if;
  if length(purchase_source) not between 1 and 300 or length(note)>2000 then raise exception 'ระบุแหล่งซื้อและตรวจความยาวหมายเหตุ'; end if;
  if length(item_unit) not between 1 and 50 then raise exception 'ระบุหน่วยไม่เกิน 50 ตัวอักษร'; end if;
  if coalesce(i->>'qty','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' or coalesce(i->>'unit_price','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'จำนวนหรือราคาไม่ถูกต้อง'; end if;
  if jsonb_typeof(i->'vat') is distinct from 'boolean' then raise exception 'ระบุ VAT หรือ NON VAT'; end if;
  q=(i->>'qty')::numeric;unit_price=(i->>'unit_price')::numeric;vat=(i->>'vat')::boolean;
  if q<=0 or q>1000000 or unit_price<=0 or unit_price>1000000000 then raise exception 'จำนวนหรือราคาอยู่นอกช่วงที่รองรับ'; end if;
  total=round(q*unit_price*100);base=case when vat then round(total*100.0/107.0) else total end;
  if total>100000000000 or base<=0 then raise exception 'ยอดต่อรายการต้องอยู่ระหว่าง 0.01 ถึง 1,000,000,000 บาท'; end if;
  normalized=normalized||jsonb_build_array(jsonb_build_object('name',item_name,'spec',spec,'source',purchase_source,'note',note,'qty',q::text,'unit',item_unit,'unit_price',unit_price::text,'vat',vat,'base_cents',base,'tax_cents',total-base,'total_cents',total));
  sum_base=sum_base+base;sum_total=sum_total+total;
 end loop;
 insert into public.purchase_orders(po_number,po_date,created_by,requester_name,department,items,base_cents,tax_cents,total_cents)
 values('PO-'||to_char(p_po_date,'YYYY')||'-'||lpad(nextval('public.po_number_seq')::text,6,'0'),p_po_date,a.id,a.display_name,btrim(p_department),normalized,sum_base,sum_total-sum_base,sum_total) returning * into p;
 insert into public.po_events(po_id,actor_id,actor_name,action) values(p.id,a.id,a.display_name,'create');
 insert into public.notifications(recipient_id,po_id,action,title,message)
 select id,p.id,'create','มีใบขอซื้อใหม่',a.display_name||' เปิด '||p.po_number
 from public.profiles where role='owner' and deleted_at is null
 on conflict(recipient_id,po_id,action) do nothing;
 insert into public.po_commands values(a.id,p_request_id,payload,to_jsonb(p));
 return to_jsonb(p);
end $$;

create function public.act_on_po(p_id uuid,p_action text,p_version integer,p_reason text,p_invoice_confirmed boolean,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.profiles%rowtype;p public.purchase_orders%rowtype;c public.po_commands%rowtype;payload jsonb;next_status text;reason text=btrim(coalesce(p_reason,''));
begin
 select * into a from public.profiles where id=auth.uid();
 if a.id is null then raise exception 'บัญชีนี้ไม่มีสิทธิ์ใช้งาน'; end if;
 if p_request_id is null or p_version is null then raise exception 'คำขอไม่ครบถ้วน'; end if;
 if p_action is null or p_action not in ('approve','reject','receive','close') then raise exception 'คำสั่งไม่ถูกต้อง'; end if;
 if (p_action='receive' and a.role<>'office') or (p_action in ('approve','reject','close') and a.role<>'owner') then raise exception 'บทบาทนี้ไม่มีสิทธิ์ทำรายการ'; end if;
 payload=jsonb_build_object('id',p_id,'action',p_action,'version',p_version,'reason',reason,'invoice',p_invoice_confirmed);
 perform pg_advisory_xact_lock(hashtextextended(a.id::text||p_request_id::text,0));
 select * into c from public.po_commands where actor_id=a.id and request_id=p_request_id;
 if found then
  if c.payload<>payload then raise exception 'หมายเลขคำขอนี้ใช้กับข้อมูลอื่นแล้ว'; end if;
  return c.result;
 end if;
 select * into p from public.purchase_orders where id=p_id for update;
 if not found then raise exception 'ไม่พบใบ PO'; end if;
 if p.version<>p_version then raise exception 'สถานะเปลี่ยนแล้ว กรุณากลับรายการและโหลดข้อมูลล่าสุด'; end if;
 if length(reason)>2000 then raise exception 'เหตุผลต้องไม่เกิน 2,000 ตัวอักษร'; end if;
 if p_action in ('approve','reject') and p.status='pending' then
  if p_action='reject' and reason='' then raise exception 'ระบุเหตุผลที่ไม่อนุมัติ'; end if;
  next_status=case when p_action='approve' then 'approved' else 'rejected' end;
 elsif p_action='receive' and p.status='approved' then next_status='received';
 elsif p_action='close' and p.status='received' then
  if p_invoice_confirmed is distinct from true then raise exception 'ต้องยืนยันว่าได้รับใบกำกับภาษีแล้ว'; end if;
  next_status='closed';
 else raise exception 'ไม่สามารถดำเนินการในสถานะนี้ได้';
 end if;
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
  on conflict(recipient_id,po_id,action) do nothing;
 else
  insert into public.notifications(recipient_id,po_id,action,title,message)
  select id,p.id,p_action,'ได้รับสินค้าแล้ว',a.display_name||' ยืนยันรับสินค้า '||p.po_number
  from public.profiles where role='owner' and deleted_at is null
  on conflict(recipient_id,po_id,action) do nothing;
 end if;
 insert into public.po_commands values(a.id,p_request_id,payload,to_jsonb(p));
 return to_jsonb(p);
end $$;

create function public.po_counts(p_mine boolean default false) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) as n from public.purchase_orders where not p_mine or created_by=(select auth.uid()) group by status) counts;
$$;
create function public.monthly_po_report(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='office' and can_export_report and deleted_at is null) then
  raise exception 'บัญชีนี้ไม่มีสิทธิ์ดูรายงานรวม';
 end if;
 with selected as (
  select * from public.purchase_orders where po_date>=date_trunc('month',p_month)::date and po_date<(date_trunc('month',p_month)+interval '1 month')::date
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(s) order by po_date desc,created_at desc) from selected s),'[]'::jsonb),
  'total_cents',coalesce((select sum(total_cents) from selected where status in ('approved','received','closed')),0),
  'ordered_count',(select count(*) from selected where status in ('approved','received','closed')),
  'pending_count',(select count(*) from selected where status='pending'),
  'rejected_count',(select count(*) from selected where status='rejected')
 ) into result;
 return result;
end $$;
revoke all on function public.create_po(jsonb,date,uuid,text),public.act_on_po(uuid,text,integer,text,boolean,uuid),public.po_counts(boolean),public.monthly_po_report(date) from public,anon;
grant execute on function public.create_po(jsonb,date,uuid,text),public.act_on_po(uuid,text,integer,text,boolean,uuid),public.po_counts(boolean),public.monthly_po_report(date) to authenticated;
commit;
