# การสำรองและกู้ข้อมูล PO

ผู้ดูแลการสำรองข้อมูลคือเจ้าของโปรเจกต์ PO ในองค์กร Perthyw GRAND โดยจำกัดสิทธิ์ Dashboard และไฟล์สำรองไว้กับเจ้าของ/ผู้ที่ได้รับมอบหมาย ไม่เผยแพร่สำเนาข้อมูลหรือข้อมูลรับรองใน GitHub

## รอบตรวจและสำรอง

- สำรองข้อมูลแอปทุกวันศุกร์ช่วงเช้า เวลาไทย ผ่านงานอัตโนมัติที่ตั้งไว้ เริ่ม 9 ตุลาคม 2569 พร้อมตรวจความสมบูรณ์และแจ้งผล
- ตรวจพื้นที่ทุกวันที่ 1 ของเดือน และแจ้งเมื่อฐานข้อมูลแตะประมาณ 350 MB จากโควต้า Free 500 MB ต่อโปรเจกต์
- ไม่ลบ PO อัตโนมัติ ไม่ลบใบที่ยังดำเนินการอยู่ หากต้องลดพื้นที่ให้ตกลงอายุข้อมูลและทดสอบสำเนาก่อนลบจริง
- เก็บสำเนารายสัปดาห์ไว้ในพื้นที่ส่วนตัวและตรวจคืนข้อมูลเป็นระยะ; ไม่อนุมัติการลบสำเนาเก่าอัตโนมัติจากเอกสารนี้

## ขอบเขตสำเนาปัจจุบัน

ใช้ `scripts/backup-snapshot-readonly.sql` กับ project `rhkilsnuqdkzwlncjvkj` เท่านั้น เป็น SELECT เดียวที่เก็บ 7 ตาราง PO พร้อม metadata schema, constraints, RLS policies, indexes, triggers, RPC definitions, table grants และสถานะ `po_number_seq` รวมกับ migration SQL ใน repo และ SHA256 ของไฟล์/ข้อมูล

นี่คือ **application-only snapshot** ไม่ใช่สำเนา Supabase เต็มระบบ: ไม่รวม Auth identities จริง, password hashes, sessions, Storage objects, secrets, Auth/provider/Dashboard settings หรือ schemas อื่น สถานะ sequence ไม่เป็น transactional จึงควรสำรองในช่วงไม่มีการเปิด PO ใหม่ และตรวจเลขลำดับก่อนกู้จริง

## ผลทดสอบกู้คืน 2 ตุลาคม 2569

สำเนาจาก production เวลา 17:54:44 ไทยถูกกู้ลง project แยก `PO-restore-test-20261002` (`tctartzpqrbxhkcgwmmu`) ในองค์กรเดียวกันโดยไม่เขียนหรือกู้ทับ production และทดสอบซ้ำใน PGlite แยก

| ตาราง | จำนวนแถว | ตรวจเนื้อหาหลังคืน |
|---|---:|---|
| profiles | 12 | SHA256 ตรง |
| departments | 14 | SHA256 ตรง |
| purchase_orders | 8 | SHA256 ตรง |
| po_items | 9 | SHA256 ตรง |
| po_events | 24 | SHA256 ตรง |
| notifications | 30 | SHA256 ตรง |
| po_commands | 24 | SHA256 ตรง |

ตรวจ 10 foreign keys, constraints, RLS policies, indexes และ sequence ตรงกัน (`last_value=8`, `is_called=true`); PGlite ตรวจ 61 คอลัมน์ตรง metadata จริง และคืน RPC ธุรกิจ 5 ตัวจาก definitions ที่อ่านจาก production

สร้าง Auth placeholders ใน project ทดสอบเฉพาะ UUID 12 รายการเพื่อรองรับ foreign keys โดยไม่มี email/password และ banned_until=infinity ทุกบัญชี จึงไม่ใช่การกู้บัญชีล็อกอิน เปิด RLS ทั้ง 7 ตารางและปิด public signup ของ project ทดสอบแล้ว การจำลองบทบาท authenticated ผ่าน SQL พบ owner/primary เห็น 8 ใบ, office ทั่วไปเห็นเฉพาะขอบเขตตน และ disabled profile เห็น 0 ใบ/0 profile; ไม่มีบัญชีเห็น notifications ของผู้อื่น การตรวจนี้เป็นการจำลอง SQL role ไม่ใช่การล็อกอิน Auth ของ project ทดสอบ

`rls_auto_enable()` ซึ่ง production มี ไม่มีอยู่ใน project ทดสอบรุ่น PostgreSQL ใหม่ จึงไม่สร้าง event trigger ของแพลตฟอร์มขึ้นเอง; revoke production ถูกจัดการผ่าน migration แยกแล้ว

## ขั้นตอนกู้คืนที่จำกัดความเสี่ยง

1. ตรวจ SHA256 และ metadata ของสำเนา พร้อมยืนยัน source/target ref; target ต้องเป็นฐาน PO ทดสอบแยกที่ไม่มีข้อมูล
2. ใช้ migration เพื่อสร้าง schema/RLS/RPC แล้วคืนข้อมูลตามลำดับ profiles → departments → purchase_orders → po_items → po_events → notifications → po_commands ใน transaction
3. คืน sequence และ RPC definitions จริง; ในฐานทดสอบที่ไม่มี Auth identities ให้ใช้ placeholders แบบ banned เท่านั้น
4. เปรียบเทียบจำนวนแถวและ SHA256 ทุกตาราง, FK/constraints/RLS/indexes/sequence และสิทธิ์อ่านตามบทบาท พร้อมปิด signup ของ target
5. ไม่กู้ทับ production จากสคริปต์ทดสอบ หากเป็นเหตุจริงต้องให้เจ้าของอนุมัติแผนและผลทดสอบที่ตรวจได้ก่อน

## สิ่งที่ยังไม่ใช่การกู้เต็มระบบ

การกู้ Auth credentials และบริการ Supabase ครบต้องมี logical dump ที่เจ้าของให้รหัสเชื่อมต่อฐานข้อมูลโดยตรง ใช้ Supabase CLI export roles/schema/data และกู้ใน target แยก จากนั้นตั้ง Auth providers, SMTP, secrets, Edge Functions และ Storage แยก ตรวจล็อกอินจริงอีกครั้ง ห้ามอ่าน credentials จาก hidden storage หรือรีเซ็ตรหัสฐาน production เพื่อสำรองโดยไม่แจ้งเจ้าของ

เอกสารอ้างอิง: https://supabase.com/docs/guides/platform/backups และ https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
