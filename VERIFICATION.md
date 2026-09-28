# ผลตรวจ PO The Grands — 25 กันยายน 2026

## อัตโนมัติ

- `npm test`: 15/15 ผ่าน
- สูตร VAT ราคารวม 3,000 บาท: ฐาน 2,803.74 บาท, VAT 196.26 บาท, รวม 3,000.00 บาท
- ครอบคลุม NON VAT, rounding, validation, วันที่ผิด, lifecycle, เหตุผลปฏิเสธ, invoice gate, monthly report permission, idempotency, RLS, anonymous/outsider, direct write denial และ atomic rollback
- PostgreSQL ทดสอบด้วย PGlite ฐานใหม่แยกทุกครั้ง โดยจำลอง `auth.uid()` ไม่แตะฐานจริง
- REST adapter ทดสอบด้วย mock fetch สำหรับ login, paging, create date/request UUID, monthly report, network failure และ session expiry
- `npm run check` ผ่านสำหรับ `app.js`, `api.js`, `domain.js`, `export.js`
- `npm audit --omit=dev` รายงาน 0 vulnerabilities ตอน vendoring ExcelJS

## Browser จริงในโหมดสาธิต

- หน้า login แยกบัญชีออฟฟิศ/เจ้าของ และปุ่ม “เปลี่ยนบัญชีผู้ใช้งาน” ทำงาน
- ฟอร์มแสดงวันที่เริ่มต้น 25 กันยายน 2569 เลือกใหม่ได้ พร้อมแหล่งซื้อและหมายเหตุ
- ราคาสุทธิ 3,000 บาทที่ติ๊ก VAT คำนวณทันทีเป็นฐาน 2,803.74 บาท และ VAT 196.26 บาท ทั้งฟอร์มและหน้าตรวจทาน
- หน้ารายเดือนรวมยอดสถานะที่อนุมัติแล้วได้ 8,625.00 บาท และคำสั่ง Export Excel แสดงผลสำเร็จ
- บัญชีเจ้าของเห็นหน้าจัดการบัญชีออฟฟิศ บัญชีออฟฟิศไม่เห็นเมนูนี้
- เจ้าของไม่สามารถเรียกรายงานรวมได้ บัญชีออฟฟิศต้องได้รับ `can_export_report=true`; หน้าเว็บซ่อนเมนูและ RPC ตรวจสิทธิ์ซ้ำ
- ตรวจ syntax และชุดทดสอบล่าสุด 2026-09-28: 15 tests ผ่านทั้งหมด; strict UI audit 0 findings
- ตรวจ viewport 390 × 844 แล้ว ฟอร์มและการ์ดไม่ล้นแนวนอน เมนูหลักเลื่อนได้และซ่อน scrollbar
- browser console ไม่มี error หรือ warning ระหว่าง flow ที่ตรวจ

## สิ่งที่ยังต้องตรวจเมื่อมี Supabase

ยังไม่มี Supabase project จริง จึงยังไม่ได้พิสูจน์ Auth, Edge Function, REST/RPC, RLS, refresh token, multi-device, network failure หรือ production export กับข้อมูลจริง ต้องทำ checklist ใน `SUPABASE-SETUP.md` ก่อนใช้งานจริง

โหมดสาธิตมี login และการตั้งรหัสผ่านเพื่อทดลอง flow แต่ข้อมูล PO อยู่ในหน่วยความจำและรหัสผ่านอยู่เฉพาะ browser นี้ ไม่ใช้แทน Supabase production
