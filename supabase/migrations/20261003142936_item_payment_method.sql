-- Payment method is purchase metadata, not evidence of payment or permission to close a PO.
-- Existing rows and purchase_orders.items JSON are deliberately left unchanged.
alter table public.po_items add column payment_method text;
alter table public.po_items add constraint po_items_payment_method_check check (payment_method is null or payment_method in ('credit','cash'));
comment on column public.po_items.payment_method is 'Selected purchase payment method; null means legacy unspecified. Not payment status.';

CREATE OR REPLACE FUNCTION public.create_po(p_items jsonb, p_po_date date, p_request_id uuid, p_department text DEFAULT 'ออฟฟิศ'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 a public.profiles%rowtype; p public.purchase_orders%rowtype; c public.po_commands%rowtype;
 i jsonb; normalized jsonb='[]'; payload jsonb; q numeric; unit_price numeric;
 base bigint; total bigint; sum_base bigint=0; sum_total bigint=0; vat boolean;
 item_name text; spec text; purchase_source text; note text; item_unit text; item_department text; department_id uuid; payment_method text;
begin
 select * into a from public.profiles where id=auth.uid();
 if a.id is null or a.deleted_at is not null or a.role<>'office' then raise exception 'เฉพาะออฟฟิศที่ได้รับสิทธิ์เท่านั้นที่เปิด PO ได้'; end if;
 if p_request_id is null then raise exception 'ไม่พบหมายเลขคำขอ'; end if;
 if p_po_date is null or p_po_date<'2000-01-01' or p_po_date>'2099-12-31' then raise exception 'วันที่ใบ PO ไม่ถูกต้อง'; end if;
 payload=jsonb_build_object('action','create','po_date',p_po_date,'items',p_items,'department',p_department);
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
  if i ? 'payment_method' and jsonb_typeof(i->'payment_method') not in ('string','null') then raise exception 'วิธีชำระเงินต้องเป็นเครดิตหรือเงินสด'; end if;
  payment_method=nullif(i->>'payment_method','');
  if payment_method is not null and payment_method not in ('credit','cash') then raise exception 'วิธีชำระเงินต้องเป็นเครดิตหรือเงินสด'; end if;
  item_department=btrim(coalesce(i->>'department',p_department,''));
  select id into department_id from public.departments where name=item_department and archived_at is null;
  if department_id is null then raise exception 'เลือกแผนก/สาขาที่มีในระบบสำหรับทุกรายการ'; end if;
  if length(item_name) not between 1 and 200 or length(spec) not between 1 and 2000 then raise exception 'ระบุชื่อสินค้าและสเปคให้ครบ'; end if;
  if length(purchase_source) not between 1 and 300 or length(note)>2000 then raise exception 'ระบุแหล่งซื้อและตรวจความยาวหมายเหตุ'; end if;
  if length(item_unit) not between 1 and 50 then raise exception 'ระบุหน่วยไม่เกิน 50 ตัวอักษร'; end if;
  if coalesce(i->>'qty','') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' or coalesce(i->>'unit_price','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'จำนวนหรือราคาไม่ถูกต้อง'; end if;
  if jsonb_typeof(i->'vat') is distinct from 'boolean' then raise exception 'ระบุ VAT หรือ NON VAT'; end if;
  q=(i->>'qty')::numeric;unit_price=(i->>'unit_price')::numeric;vat=(i->>'vat')::boolean;
  if q<=0 or q>1000000 or unit_price<=0 or unit_price>1000000000 then raise exception 'จำนวนหรือราคาอยู่นอกช่วงที่รองรับ'; end if;
  total=round(q*unit_price*100);base=case when vat then round(total*100.0/107.0) else total end;
  if total>100000000000 or base<=0 then raise exception 'ยอดต่อรายการต้องอยู่ระหว่าง 0.01 ถึง 1,000,000,000 บาท'; end if;
  normalized=normalized||jsonb_build_array(jsonb_build_object('department',item_department,'payment_method',payment_method,'name',item_name,'spec',spec,'source',purchase_source,'note',note,'qty',q::text,'unit',item_unit,'unit_price',unit_price::text,'vat',vat,'base_cents',base,'tax_cents',total-base,'total_cents',total));
  sum_base=sum_base+base;sum_total=sum_total+total;
 end loop;
 insert into public.purchase_orders(po_number,po_date,created_by,requester_name,department,items,base_cents,tax_cents,total_cents)
 values('PO-'||to_char(p_po_date,'YYYY')||'-'||lpad(nextval('public.po_number_seq')::text,6,'0'),p_po_date,a.id,a.display_name,case when (select count(distinct value->>'department') from jsonb_array_elements(normalized))=1 then normalized->0->>'department' else 'หลายแผนก/สาขา' end,normalized,sum_base,sum_total-sum_base,sum_total) returning * into p;
 insert into public.po_items(po_id,line_no,department_id,name,spec,source,note,qty,unit,unit_price,vat,base_cents,tax_cents,total_cents,payment_method)
 select p.id,ord::smallint,d.id,x.value->>'name',x.value->>'spec',x.value->>'source',x.value->>'note',(x.value->>'qty')::numeric,x.value->>'unit',(x.value->>'unit_price')::numeric,(x.value->>'vat')::boolean,(x.value->>'base_cents')::bigint,(x.value->>'tax_cents')::bigint,(x.value->>'total_cents')::bigint,x.value->>'payment_method'
 from jsonb_array_elements(normalized) with ordinality as x(value,ord)
 join public.departments d on d.name=x.value->>'department';
 insert into public.po_events(po_id,actor_id,actor_name,action) values(p.id,a.id,a.display_name,'create');
 insert into public.notifications(recipient_id,po_id,action,title,message)
 select id,p.id,'create','มีใบขอซื้อใหม่',a.display_name||' เปิด '||p.po_number
 from public.profiles where role='owner' and deleted_at is null
 on conflict(recipient_id,po_id,action) do nothing;
 insert into public.po_commands values(a.id,p_request_id,payload,to_jsonb(p));
 return to_jsonb(p);
end $function$
;
