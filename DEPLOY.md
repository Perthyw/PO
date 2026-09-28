# ขึ้นเว็บ PO The Grands

`dist/` เป็นเว็บ static สำหรับโฮสต์ HTTPS เช่น Cloudflare Pages, Netlify หรือ static hosting ทั่วไป

1. เชื่อม Supabase และ deploy Edge Function ตาม `SUPABASE-SETUP.md`
2. ใส่ Project URL และ publishable key ใน `dist/config.js`
3. อัปโหลดไฟล์ทั้งหมดภายใน `dist/` เป็น root ของเว็บไซต์ รวม `dist/vendor/exceljs.min.js` และ `dist/vendor/EXCELJS-LICENSE.txt`
4. ไม่ต้องใช้ build command; publish directory คือ `dist`
5. ตรวจให้ `app.js`, `api.js`, `domain.js`, `export.js`, `config.js`, `style.css`, `favicon.svg` และไฟล์ใน `vendor/` โหลดได้ด้วย MIME type ที่ถูกต้อง
6. ตั้ง `ALLOWED_ORIGINS` ของ Edge Function ให้ตรงกับโดเมนจริง แล้วทดสอบ login, ขั้นตอน PO และการดาวน์โหลด Excel

เว็บไม่มี server secret ข้อมูลจริงอยู่ใน Supabase ของ project นี้ โหมดสาธิตไม่ใช่ที่เก็บข้อมูลจริง
