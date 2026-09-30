# ผลตรวจ PO The Grands — อัปเดต 30 กันยายน 2026

## อัตโนมัติ

- `npm test`: 20/20 ผ่านใน PGlite และ mock REST
- สูตร VAT ราคารวม 3,000 บาท: ฐาน 2,803.74 บาท, VAT 196.26 บาท, รวม 3,000.00 บาท
- ครอบคลุม NON VAT, rounding, validation, วันที่ผิด, lifecycle, เหตุผลปฏิเสธ, invoice gate, monthly report permission, idempotency, RLS, anonymous/outsider, direct write denial และ atomic rollback
- PostgreSQL ทดสอบด้วย PGlite ฐานใหม่แยกทุกครั้ง โดยจำลอง `auth.uid()` ไม่แตะฐานจริง
- REST adapter ทดสอบด้วย mock fetch สำหรับ login, paging, create date/request UUID, monthly report, network failure และ session expiry
- `npm run check` ผ่านสำหรับ `app.js`, `api.js`, `domain.js`, `export.js`
- Strict UI audit รอบแก้ครั้งนี้: 0 findings
- `npm audit --omit=dev` รายงาน 0 vulnerabilities ตอน vendoring ExcelJS

## Browser จริงในโหมดสาธิต

- หน้า login แยกบัญชีออฟฟิศ/เจ้าของ และปุ่ม “เปลี่ยนบัญชีผู้ใช้งาน” ทำงาน
- ฟอร์มแสดงวันที่เริ่มต้น 25 กันยายน 2569 เลือกใหม่ได้ พร้อมแหล่งซื้อและหมายเหตุ
- ราคาสุทธิ 3,000 บาทที่ติ๊ก VAT คำนวณทันทีเป็นฐาน 2,803.74 บาท และ VAT 196.26 บาท ทั้งฟอร์มและหน้าตรวจทาน
- หน้ารายเดือนรวมยอดสถานะที่อนุมัติแล้วได้ 8,625.00 บาท และคำสั่ง Export Excel แสดงผลสำเร็จ
- บัญชีเจ้าของเห็นหน้าจัดการบัญชีออฟฟิศ บัญชีออฟฟิศไม่เห็นเมนูนี้
- Supabase จริง: owner session เปิดหน้าจัดการผู้ใช้ได้; `qa.office01` login ได้, อ่านรายการ PO และเปิดฟอร์มสร้าง PO ได้โดยไม่ submit; เมนูผู้ใช้งานไม่ปรากฏใน session office
- Supabase จริง: หลัง owner ลบบัญชีทดสอบ `qa.office01`, login ถูกปฏิเสธด้วย `User is banned`; ยืนยันว่า account ban ทำงานจริง (ไม่ได้ทดสอบการอ่านข้อมูลด้วย session ที่ถูกปิด)
- Supabase จริง: หลัง owner ปิดบัญชีทดสอบ `qa.office02` และยังคง office tab เดิมไว้, office เปิด PO ใหม่ไม่ได้เพราะแผนก/สาขาไม่โหลด และเปิด PO เดิมไม่พบ; owner ยังคงเห็น PO และเปิดรายละเอียดได้ ยืนยันการอ่านถูกจำกัดตาม RLS พร้อมรักษาประวัติไว้
- เจ้าของไม่สามารถเรียกรายงานรวมได้ บัญชีออฟฟิศต้องได้รับ `can_export_report=true`; หน้าเว็บซ่อนเมนูและ RPC ตรวจสิทธิ์ซ้ำ
- รายการตรวจ browser ด้านล่างเป็นผลตรวจเดิมก่อนแก้ schema/หน้าแผนกครั้งนี้
- ตรวจ viewport 390 × 844 แล้ว ฟอร์มและการ์ดไม่ล้นแนวนอน เมนูหลักเลื่อนได้และซ่อน scrollbar
- browser console ไม่มี error หรือ warning ระหว่าง flow ที่ตรวจ

## ตรวจ Supabase จริง ณ 30 กันยายน 2026

- Project `rhkilsnuqdkzwlncjvkj`: `db push --dry-run` ผ่าน; migration `20260929000000` อยู่ทั้ง local และ remote
- Owner Auth user/profile ถูกสร้างโดยใช้ UUID เดียวกัน (ไม่บันทึกข้อมูลรับรองลง Git)
- `manage-user` deploy แล้ว; preflight จาก `http://localhost:4180` ได้ 204, origin อื่นได้ 403, ไม่มี session ได้ 401
- `dist/config.js` ชี้ Project URL และ Publishable key ไปยัง project PO; local config และหน้าเว็บตอบ 200 และ Auth health endpoint ตอบ 200
- ทดสอบ sign-in, role owner/office, disabled-account login lockout และ RLS read ด้วย office session เดิมหลังปิดบัญชีผ่านหน้าเว็บจริงแล้ว; ยังไม่ทดสอบ refresh/expiry, production write RPC ในทุกบทบาท, multi-device หรือ production export
- ยังต้องยืนยันการปิด public signup ก่อนใช้งานจริง

การแก้ครั้งก่อนทดสอบการบันทึกแผนกแยกตามรายการสินค้า, สิทธิ์อ่าน `po_items`, การเพิ่มและเก็บแผนก, การห้ามออฟฟิศทั่วไปยืนยันรับสินค้าของคนอื่น และการปฏิเสธ RPC สำหรับบัญชีที่ปิดใช้งานใน PGlite แล้ว

โหมดสาธิตมี login และการตั้งรหัสผ่านเพื่อทดลอง flow ข้อมูล PO และบัญชีอยู่ใน Local Storage ของ browser นี้และไม่ใช้แทน Supabase production
