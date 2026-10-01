# ผลตรวจ PO The Grands — อัปเดต 30 กันยายน 2026

## อัตโนมัติ

- `npm test`: 21/21 ผ่านใน PGlite และ mock REST
- สูตร VAT ราคารวม 3,000 บาท: ฐาน 2,803.74 บาท, VAT 196.26 บาท, รวม 3,000.00 บาท
- ครอบคลุม NON VAT, rounding, validation, วันที่ผิด, lifecycle, เหตุผลปฏิเสธ, invoice gate, monthly report permission, idempotency, RLS, anonymous/outsider, direct write denial และ atomic rollback
- PostgreSQL ทดสอบด้วย PGlite ฐานใหม่แยกทุกครั้ง โดยจำลอง `auth.uid()` ไม่แตะฐานจริง
- REST adapter ทดสอบด้วย mock fetch สำหรับ login, paging, create date/request UUID, monthly report, network failure และ session expiry
- เพิ่ม test สำหรับ persist/restore session หลัง reload, refresh token ที่ใกล้หมดอายุ, network error ระหว่าง restore โดยเก็บ session เพื่อ retry และล้าง session เมื่อ profile ถูกปิด
- Supabase จริง: owner login แล้ว reload หน้าเว็บ; กลับเข้าหน้ารายการโดยไม่ต้อง login ซ้ำ และโหลดรายการ PO จาก project ได้
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
- `manage-user` deploy แล้ว; preflight จาก `http://localhost:4180` และ `https://po-thegrands.vercel.app` ได้ 204, origin อื่นได้ 403, ไม่มี session จาก Vercel ได้ 401; เจ้าของยืนยันเปิดหน้า “ผู้ใช้งาน” บน Vercel ด้วย owner session ได้ (2026-10-01)
- `dist/config.js` ชี้ Project URL และ Publishable key ไปยัง project PO; local config และหน้าเว็บตอบ 200 และ Auth health endpoint ตอบ 200
- ทดสอบ sign-in, role owner/office, disabled-account login lockout, RLS read ด้วย office session เดิมหลังปิดบัญชี และ owner session persistence หลัง reload ผ่านหน้าเว็บจริงแล้ว; จำลองเวลาหมดอายุใน local session แล้ว reload พบว่า refresh token กับ Supabase สำเร็จและกลับรายการโดยไม่ถาม login ใหม่; ยังไม่ได้รอ JWT หมดอายุจริงตามเวลา รวมถึง production write RPC ทุกบทบาท, multi-device และ production export
- Browser จริง (2026-09-30): ทดสอบ DevTools Network > Offline ขณะหน้า PO เปิดอยู่ หน้าแสดงข้อความเชื่อมต่อไม่ได้และปุ่ม “ลองโหลดใหม่” โดยไม่แสดงข้อมูล demo; คืนเป็น No throttling และกดลองใหม่แล้วกลับมาใช้งานได้
- ตรวจ flow ใน source: เมื่อมี Supabase URL และ Publishable key จะใช้ Supabase API; API/network error ถูกส่งเป็นข้อผิดพลาดและไม่มีการสลับไป demo adapter. ยืนยันด้วย mock REST, browser Offline จริง และผู้ใช้ทดสอบ Offline บน Vercel แล้ว
- Vercel production (2026-10-01): ผู้ใช้ยืนยันว่า owner login, รายการ PO และเมนูจัดการบัญชีทำงาน; ทดสอบ Network Offline แล้วไม่มีข้อมูล demo และเมื่อตั้ง No throttling/ลองโหลดใหม่กลับมาได้; ผู้ใช้ตรวจ browser console แล้วรายงานว่าไม่มี error
- Supabase Dashboard (2026-10-01): ตรวจ URL หน้า Backups แล้วถูกพาไปหน้า sign-in; ยังตรวจ Security Advisor, plan/backups ที่เปิดใช้ และรายชื่อผู้ดูแลจาก Dashboard จริงไม่ได้จนกว่าเจ้าของจะเข้าสู่ระบบ
- Backup plan caveat: เอกสาร Supabase ปัจจุบันระบุว่า Free plan ไม่มี automatic daily backups ที่ดาวน์โหลดได้; ต้องทำ CLI logical dump ไปเก็บนอก GitHubหรือใช้แผนที่มี daily backups ก่อนปิด Task 7
- Vercel assets (2026-09-30): หน้าเว็บและ assets ที่ตรวจ (JS/CSS/config/favicon/vendor) ตอบ HTTP 200 และไฟล์ JS/CSS/config หลักตรงกับ `dist/` ใน repo; config ชี้ Supabase project PO และมี publishable key โดยไม่มี service role key
- Vercel rollback: ตรวจวิธีผ่าน Instant Rollback ใน Dashboard แล้ว แต่ยังไม่ได้กด Confirm หรือเปลี่ยน production; Vercel ระบุว่าหลัง rollback ต้อง Undo Rollback/โปรโมต deployment เพื่อเปิด auto-assignment กลับ
- Supabase CORS (2026-09-30): `ALLOWED_ORIGINS` อนุญาต `http://localhost:4180` และ `https://po-thegrands.vercel.app`; preflight ของโดเมนใหม่ได้ 204, origin ที่ไม่ได้อนุญาตได้ 403 และ POST ที่ไม่มี session ได้ 401
- Vercel alias (2026-09-30): ตรวจหลังผู้ใช้เปลี่ยนชื่อแล้ว `https://po-six-lemon.vercel.app/` ตอบ 404 ส่วน URL ใหม่ `https://po-thegrands.vercel.app/` ตอบ 200
- PO list/report UI (2026-10-01): filter คง shell/ปุ่ม scope และสถานะระหว่างโหลด; การ์ดสรุปทั้งห้าสถานะแสดงตลอดและอัปเดตเฉพาะตัวเลข; คงหัวรายการ/refresh/filters แม้ผลว่าง, ซ่อนเฉพาะ pagination และแสดงปุ่มเปิด PO ใน empty state. ป้ายสถานะในรายการใช้พาเลตตรงกับการ์ด; การ์ด “ไม่อนุมัติ” ในรายงานรายเดือนใช้สีแดงอ่อน. `npm test` และ `npm run check` ผ่าน; เจ้าของยืนยันให้แสดงการ์ดทุกสถานะและหัวข้อรายการเมื่อผลว่าง
- Sites รุ่นก่อนหน้า (2026-09-30): URL `https://po-desk-office.grandsfoods.chatgpt.site` ยังคงเป็น release แยกแบบ owner-only; ไม่ใช่ production URL หลักที่ผู้ใช้ระบุ
- ยังต้องยืนยันการปิด public signup ก่อนใช้งานจริง

การแก้ครั้งก่อนทดสอบการบันทึกแผนกแยกตามรายการสินค้า, สิทธิ์อ่าน `po_items`, การเพิ่มและเก็บแผนก, การห้ามออฟฟิศทั่วไปยืนยันรับสินค้าของคนอื่น และการปฏิเสธ RPC สำหรับบัญชีที่ปิดใช้งานใน PGlite แล้ว

โหมดสาธิตมี login และการตั้งรหัสผ่านเพื่อทดลอง flow ข้อมูล PO และบัญชีอยู่ใน Local Storage ของ browser นี้และไม่ใช้แทน Supabase production
