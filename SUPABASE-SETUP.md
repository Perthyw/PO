# เชื่อม Supabase สำหรับ PO The Grands

สถานะปัจจุบัน: สร้าง Supabase project แล้วที่ `https://rhkilsnuqdkzwlncjvkj.supabase.co` แต่ยังต้องรัน schema, สร้าง owner, deploy Edge Function, ใส่ Publishable key และทดสอบระบบจริงก่อนใช้งาน production

## ตั้งค่าครั้งแรก

1. ใช้ Supabase project ของ PO The Grands โดยเฉพาะ อย่าใช้ project หรือตารางของ Grandhouse
2. ตรวจ migration `supabase/migrations/20260929000000_initial_po_schema.sql` และตรวจว่า project ยังไม่มี schema ชุดนี้ จากนั้นใช้ Supabase CLI กับ project นี้: `npx supabase login`, `npx supabase link --project-ref rhkilsnuqdkzwlncjvkj`, `npx supabase db push --dry-run`, แล้วจึง `npx supabase db push` เมื่อพร้อมนำขึ้นจริง ห้ามรัน migration เดียวกันซ้ำผ่าน SQL Editor
3. ใน Authentication ปิดการสมัครสมาชิกสาธารณะ
4. สร้างผู้ใช้เจ้าของหนึ่งบัญชีใน Authentication พร้อมรหัสผ่าน แล้วคัดลอก UUID
5. เพิ่มโปรไฟล์เจ้าของ โดยแทนค่า UUID และอีเมลจริง:

```sql
insert into public.profiles(id, login_email, display_name, role)
values ('UUID-OF-OWNER', 'owner@example.com', 'เจ้าของ', 'owner');
```

6. ติดตั้ง Supabase CLI และ login จากนั้น deploy Edge Function สำหรับให้เจ้าของสร้าง/เปลี่ยนรหัสผ่านออฟฟิศ:

```sh
npx supabase login
npx supabase link --project-ref rhkilsnuqdkzwlncjvkj
npx supabase functions deploy manage-user --no-verify-jwt
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:4180
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` และ `SUPABASE_SERVICE_ROLE_KEY` ถูกใส่ให้ Edge Function โดย Supabase อย่านำ service-role key ไปไว้ในเว็บ

7. ใส่ Project URL และ publishable key ใน `dist/config.js`:

```js
export const config = {
  supabaseUrl: 'https://rhkilsnuqdkzwlncjvkj.supabase.co',
  publishableKey: 'YOUR-PUBLISHABLE-KEY'
};
```

8. Deploy `dist/` แล้วเข้าสู่ระบบด้วยอีเมลเจ้าของ เปิดเมนู “ผู้ใช้งาน” เพื่อสร้างชื่อผู้ใช้ออฟฟิศ เช่น `purchase.fai01` กำหนดรหัสผ่านตัวเลขหรือตัวอักษรอย่างน้อย 6 ตัว และเปิดสิทธิ์ “ดูและ Export รายงานรวม” ให้บัญชีหลัก

หากมีหลายโดเมน ให้กำหนด `ALLOWED_ORIGINS` คั่นด้วย comma ต้องใส่ origin ตรงตัว เช่น `https://po.example.com` โดยไม่มี path

## กติกาข้อมูลและสิทธิ์

- เจ้าของและบัญชีออฟฟิศหลักอ่าน PO และประวัติของทุกคนได้ บัญชีออฟฟิศทั่วไปอ่านเฉพาะ PO ที่ตนเองเปิด
- ออฟฟิศเปิด PO และยืนยันรับสินค้า เจ้าของอนุมัติ ปฏิเสธ ปิด PO และจัดการบัญชีออฟฟิศ เฉพาะบัญชีออฟฟิศที่ได้รับสิทธิ์จึงดูและ Export รายงานรวมได้
- ผู้ใช้ทั่วไปแก้ role หรือเพิ่ม profile เองไม่ได้ ผู้ไม่มี profile และ anonymous อ่านข้อมูลไม่ได้
- browser เขียน PO ผ่าน RPC เท่านั้น ตารางธุรกรรมไม่อนุญาต direct insert/update/delete
- `departments` เป็นรายการแผนก/สาขาที่บัญชีออฟฟิศหลักจัดการ การลบในหน้าเว็บเป็นการเก็บเข้าคลังเพื่อรักษาใบ PO เก่า แต่ไม่ให้เลือกในใบใหม่
- `po_items` เก็บสินค้าทีละรายการพร้อมแผนก/สาขา และ `purchase_orders.items` เก็บ snapshot รูปแบบเดิมที่หน้าเว็บใช้ ทั้งคู่บันทึกพร้อมกันใน transaction ของ `create_po`; ห้ามแก้โดยตรง
- ออฟฟิศทั่วไปยืนยันรับสินค้าได้เฉพาะใบที่ตนเปิด บัญชีหลักยืนยันแทนได้; บัญชีที่ปิดใช้งานเรียก RPC ไม่ได้
- ราคาที่กรอกเป็นยอดรวม VAT ต่อหน่วย ถ้าติ๊ก VAT ฐาน = round(ยอดรวม × 100/107) และ VAT = ยอดรวม − ฐาน เช่น 3,000 บาท → ฐาน 2,803.74 บาท + VAT 196.26 บาท
- จำนวนทศนิยมได้ไม่เกิน 3 ตำแหน่ง ราคาทศนิยมได้ไม่เกิน 2 ตำแหน่ง สูงสุด 50 รายการต่อใบ
- request UUID ป้องกันส่งซ้ำ; row lock และ version ป้องกันการทำรายการจากสถานะเก่า
- วันที่ PO เลือกได้ เวลาเปิดและประวัติใช้เวลา server แล้วแสดงเป็นเวลาไทย
- หาก Supabase ล้มเหลว ระบบแสดงข้อผิดพลาดและไม่ fallback เป็นข้อมูลสาธิต

## ตรวจจริงก่อนใช้งาน

- ทดสอบเจ้าของสร้าง/เปลี่ยนรหัสผ่านออฟฟิศ และออฟฟิศเข้าใช้ได้
- ทดสอบ VAT 3,000 บาทให้ได้ฐาน 2,803.74 บาทและ VAT 196.26 บาททั้งหน้าเว็บและข้อมูลฐาน
- ตรวจสิทธิ์ทุกขั้น รวมการเรียก RPC โดยตรง ผู้ไม่มี profile และ anonymous
- ตรวจลำดับอนุมัติ รับสินค้า ปิดใบพร้อมใบกำกับ และเหตุผลเมื่อปฏิเสธ
- ตรวจรายงานรายเดือนและเปิดไฟล์ `.xlsx` ที่ส่งออก
- ทดลอง session หมดอายุ network timeout retry และสองหน้าจอแก้ใบเดียวกัน
- ตรวจ Supabase Security Advisor และแผนสำรองข้อมูล

อ้างอิง: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Edge Functions](https://supabase.com/docs/guides/functions), [Password Auth](https://supabase.com/docs/guides/auth/passwords)
