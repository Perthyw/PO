# ขึ้นเว็บ PO The Grands

เว็บ production หลักที่ผู้ใช้ deploy คือ [https://po-six-lemon.vercel.app/](https://po-six-lemon.vercel.app/) โดยใช้ไฟล์ static ใน `dist/` ส่วน Sites URL เดิมเป็น release ก่อนหน้าแบบ owner-only

1. เชื่อม Supabase และ deploy Edge Function ตาม `SUPABASE-SETUP.md`
2. ใส่ Project URL และ publishable key ใน `dist/config.js`
3. ตั้ง Vercel สำหรับ static site: Framework Preset `Other`, Build Command ว่าง, Output Directory `dist` (โปรเจกต์นี้ไม่ต้อง build)
4. ตรวจให้ `app.js`, `api.js`, `domain.js`, `export.js`, `config.js`, `style.css`, `favicon.svg` และไฟล์ใน `vendor/` โหลดได้
5. Edge Function `manage-user` ต้องอนุญาต origin `https://po-six-lemon.vercel.app` ใน `ALLOWED_ORIGINS`; ปัจจุบันตรวจ preflight จาก origin นี้แล้ว
6. ก่อนเปิดใช้จริง ให้เจ้าของทดสอบ login, ขั้นตอน PO, เมนูจัดการบัญชี และดาวน์โหลด Excel บนเว็บ Vercel

เว็บไม่มี server secret ข้อมูลจริงอยู่ใน Supabase ของ project นี้ โหมดสาธิตไม่ใช่ที่เก็บข้อมูลจริง
