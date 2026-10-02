# การกู้ข้อมูลแอปและบัญชี email/password

## ขอบเขต

สำเนาแบบ SELECT เดียวเก็บข้อมูลแอป 7 ตาราง, schema metadata, sequence และคอลัมน์บัญชีถาวรที่เลือกชัดเจนจาก auth.users/auth.identities รวม password hash โดยรักษา UUID เพื่อคง foreign keys ไม่อ่าน session, refresh token, confirmation/recovery/change/reauthentication token หรือ provider/signing secrets

นี่คือการกู้ข้อมูลแอปและบัญชีถาวร ไม่ใช่การกู้แพลตฟอร์ม Supabase ครบทุกบริการหรือ session ที่ล็อกอินอยู่ Storage ต้องตรวจแยกทุกครั้ง หากไม่มี objects ก็ไม่มีไฟล์ให้สำรองในรอบนั้น หากมีไฟล์ภายหลังต้องสำรอง bytes ผ่าน Storage API แยก

## ป้องกันข้อมูลสำรอง

เข้ารหัส archive ทั้งชุดด้วย AES-256-GCM, random key 256 bit และ IV 96 bit ใหม่ ตรวจ decrypt roundtrip แล้วเก็บ ciphertext กับ recovery-key เป็นไฟล์ส่วนตัวแยกกัน ห้ามเก็บ key ใน archive เดียวกัน ห้ามเก็บ password QA, password hashes, tokens หรือข้อมูลธุรกิจใน GitHub และห้ามแสดงค่าเหล่านี้ใน log

สคริปต์ decrypt-po-backup.mjs ใช้ Node.js และโมดูลมาตรฐาน รับ 3 path ที่ resolve แล้วต้องต่างกัน: encrypted backup, separate recovery key และ output zip ใหม่ สคริปต์ตรวจ GCM tag และ SHA256 ก่อนเขียน output แบบสิทธิ์ 0600/ไม่เขียนทับ

## เงื่อนไขก่อนกู้

ผู้คุมตรวจ source/target project identities และ target ต้องเป็น project PO ทดสอบแยกที่ได้รับอนุมัติ ไม่ใช่ production ไม่สร้าง project แบบเสียเงินและไม่เปลี่ยนรหัส production ห้ามเรียกคืน credentials จาก hidden storage

ตรวจ generated columns/defaults/constraints/trigger compatibility ใน auth.users และ auth.identities ก่อน import; confirmed_at และ identity email เป็น generated จึงไม่ใส่ใน INSERT ตรวจผู้ใช้ target ที่ไม่คาดหมายและ sessions/refresh/MFA; ถ้าพบให้หยุด ตรวจ source identity provider กับ metadata key names และหยุดถ้าพบ token/secret ฝังอยู่โดยไม่คาดหมาย

## คืนข้อมูลและตรวจ

1. คืน Auth UUID/password hashes/identities และข้อมูลแอปตาม snapshot เดียวกันใน target transaction โดยกำหนด banned_until=infinity ให้ผู้ใช้จริงทุกคน ล้าง ephemeral tokens และปิด public signup ของ target
2. เปรียบเทียบเนื้อหาและ fingerprint โดยแสดงเพียงจำนวนแถวและผลผ่าน/ไม่ผ่าน ไม่แสดง password hashes ตรวจ UUID/profile linkage, identities, foreign keys, RLS และ sequence พร้อมระบุ sequence ไม่เป็น transactional
3. ใช้ QA ที่สร้างเฉพาะใน target ด้วย password สุ่มที่เก็บเฉพาะ private harness: สำรอง QA record → เปลี่ยน hash เฉพาะ QA ขณะถูก ban → คืน hash จากสำเนา → เปิด QA ชั่วคราว → login ด้วย password เดิม → ตรวจ profile ที่ disabled อ่านไม่ได้ → logout → ban QA กลับใน finally
4. ตรวจว่า target ทุกบัญชีถูก ban และไม่มี sessions/refresh tokens หลังทดสอบ จำนวน QA เพิ่มใน target ต้องแยกออกจากจำนวน source ไม่อ้างว่าคือบัญชี production

การตรวจ QA แสดงว่า pipeline กู้ password hash แล้ว login ได้ ส่วน credentials ของผู้ใช้จริงตรวจ equality/fingerprint เท่านั้น ไม่ได้ทดลอง password หรือ unban เจ้าของจริง ไม่อ้างผล login เจ้าของจริงจากการตรวจ QA

## หลักฐานของรอบสำรอง

Archive ส่วนตัวควรมี source snapshot, SQL whitelist/templates, schema migrations, README และ proof summary แยกผล restore users/identities จริงจาก QA login proof หลังบันทึก ciphertext/key และตรวจสำเร็จจึงลบ plaintext ที่สร้างชั่วคราว ห้ามลบข้อมูล source/production

อ้างอิง: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects

## การกลับมาเปิดใช้หลังเหตุจริง

การ ban ทุกบัญชีเป็นมาตรการเฉพาะ project ทดสอบนี้ สำเนายังคง banned_until/deleted flags เดิมของ source ไว้ หากกู้เพื่อใช้งานจริง ต้องให้ผู้คุมตรวจและอนุมัติการคืนสถานะบัญชีตาม flags เดิมหลังตรวจข้อมูลและสิทธิ์ผ่าน ห้ามเปิดบัญชีที่ source ปิดไว้ ผู้ใช้ต้องเข้าสู่ระบบใหม่; ไม่คัดลอก signing key หรือ session tokens
