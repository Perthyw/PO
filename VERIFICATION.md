# ผลตรวจ PO The Grands — อัปเดต 1 ตุลาคม 2026

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
- Mobile production (2026-10-01): ผู้ใช้ยืนยันว่าเปิดเว็บบนมือถือและใช้งานได้ครบผ่าน HTTPS; Task 4 ผ่านตามการยืนยันของผู้ใช้
- Supabase Dashboard (2026-10-01): ตรวจ URL หน้า Backups แล้วถูกพาไปหน้า sign-in; ยังตรวจ Security Advisor, plan/backups ที่เปิดใช้ และรายชื่อผู้ดูแลจาก Dashboard จริงไม่ได้จนกว่าเจ้าของจะเข้าสู่ระบบ
- Backup plan caveat: เอกสาร Supabase ปัจจุบันระบุว่า Free plan ไม่มี automatic daily backups ที่ดาวน์โหลดได้; ต้องทำ CLI logical dump ไปเก็บนอก GitHubหรือใช้แผนที่มี daily backups ก่อนปิด Task 7
- Vercel assets (2026-09-30): หน้าเว็บและ assets ที่ตรวจ (JS/CSS/config/favicon/vendor) ตอบ HTTP 200 และไฟล์ JS/CSS/config หลักตรงกับ `dist/` ใน repo; config ชี้ Supabase project PO และมี publishable key โดยไม่มี service role key
- Vercel rollback: ตรวจวิธีผ่าน Instant Rollback ใน Dashboard แล้ว แต่ยังไม่ได้กด Confirm หรือเปลี่ยน production; Vercel ระบุว่าหลัง rollback ต้อง Undo Rollback/โปรโมต deployment เพื่อเปิด auto-assignment กลับ
- Supabase CORS (2026-09-30): `ALLOWED_ORIGINS` อนุญาต `http://localhost:4180` และ `https://po-thegrands.vercel.app`; preflight ของโดเมนใหม่ได้ 204, origin ที่ไม่ได้อนุญาตได้ 403 และ POST ที่ไม่มี session ได้ 401
- Vercel alias (2026-09-30): ตรวจหลังผู้ใช้เปลี่ยนชื่อแล้ว `https://po-six-lemon.vercel.app/` ตอบ 404 ส่วน URL ใหม่ `https://po-thegrands.vercel.app/` ตอบ 200
- PO list/report UI (2026-10-01): filter คง shell/ปุ่ม scope และสถานะระหว่างโหลด; การ์ดสรุปทั้งห้าสถานะแสดงตลอดและอัปเดตเฉพาะตัวเลข; คงหัวรายการ/refresh/filters แม้ผลว่าง, ซ่อนเฉพาะ pagination และแสดงปุ่มเปิด PO ใน empty state. ป้ายสถานะในรายการใช้พาเลตตรงกับการ์ด; การ์ด “ไม่อนุมัติ” ในรายงานรายเดือนใช้สีแดงอ่อน. `npm test` และ `npm run check` ผ่าน; เจ้าของยืนยันให้แสดงการ์ดทุกสถานะและหัวข้อรายการเมื่อผลว่าง
- Sites รุ่นก่อนหน้า (2026-09-30): URL `https://po-desk-office.grandsfoods.chatgpt.site` ยังคงเป็น release แยกแบบ owner-only; ไม่ใช่ production URL หลักที่ผู้ใช้ระบุ
- ปิด public signup และยืนยัน Auth settings จริง `disable_signup=true` แล้ว (2026-10-02; ดูหลักฐานท้ายเอกสาร)

การแก้ครั้งก่อนทดสอบการบันทึกแผนกแยกตามรายการสินค้า, สิทธิ์อ่าน `po_items`, การเพิ่มและเก็บแผนก, การห้ามออฟฟิศทั่วไปยืนยันรับสินค้าของคนอื่น และการปฏิเสธ RPC สำหรับบัญชีที่ปิดใช้งานใน PGlite แล้ว

โหมดสาธิตมี login และการตั้งรหัสผ่านเพื่อทดลอง flow ข้อมูล PO และบัญชีอยู่ใน Local Storage ของ browser นี้และไม่ใช้แทน Supabase production


## ตรวจต่อ Task 6–7 — 2 ตุลาคม 2026

- ตรวจ GitHub `Perthyw/PO` จริง: branch `main`, starting commit `4624e424266fcfd3353cd1f5d288257ae5264462`; ไม่ใช้ repo HR
- ตรวจ project `rhkilsnuqdkzwlncjvkj` จริง: ACTIVE_HEALTHY, องค์กร `Perthyw GRAND`, Free plan
- ข้อ 1 อนุมัติ: แก้ owner protection ใน `manage-user` แล้ว deploy version 5 (ACTIVE); อ่าน source กลับจาก Supabase แล้วตรงกับไฟล์ที่ deploy
- ป้องกัน owner ทั้งการเลือกด้วย ID และ login name; ไม่แก้ Auth เมื่อ target ไม่ใช่ active office, ID ที่ระบุไม่พบ, lookup ล้มเหลว หรือชื่อชนบัญชีอื่น; ใช้ update ที่คง role เดิม และ insert สำหรับบัญชีใหม่แทน upsert
- `npm test`: 35/35 ผ่าน (เดิม 21 + regression tests function 14); `npm run check` และ `git diff --check` ผ่าน ใช้ Node 24 สำหรับ stripTypeScriptTypes ใน function test; function tests จำลอง Auth/profile และไม่ใช่ production owner mutation test
- อ่าน Auth settings จริงผ่าน `/auth/v1/settings`: HTTP 200, `disable_signup=false`; public signup ยังเปิดอยู่และยังไม่ได้เปลี่ยน การเชื่อมต่อ Supabase MCP ชุดนี้ไม่มีเครื่องมือแก้ Auth configuration และ CLI/PAT ไม่พร้อม จึงต้องใช้ Dashboard เพื่อปิดให้เสร็จ
- Production function version 5: CORS preflight จาก Vercel ได้ 204, origin อื่นได้ 403; POST ไม่มี session ได้ 401
- ตรวจ metadata production แบบ read-only: ตาราง PO ทั้ง 7 เปิด RLS; policies จำกัดตาม active profile/ผู้สร้าง/สิทธิ์บัญชีหลัก; anon ไม่มี table grants และไม่มี EXECUTE ของ RPC ธุรกิจ; authenticated มี SELECT และ notification UPDATE เฉพาะ read_at ตาม schema
- Security Advisor: INFO `po_commands` ไม่มี policy เป็นการ deny direct access โดยตั้งใจ; RPC ธุรกิจ SECURITY DEFINER 4 ตัวมี authenticated EXECUTE ตาม flow และตรวจบทบาท/active profile ภายใน พร้อม search_path ว่าง
- ประเด็นค้าง: `public.rls_auto_enable()` มี EXECUTE สำหรับ PUBLIC/anon/authenticated (Advisor WARN) ต้องทบทวนและ revoke สิทธิ์ที่ไม่จำเป็นด้วย migration; leaked password protection ปิดอยู่ (WARN) ต้องตรวจความพร้อมของ plan ก่อนเปิด; ยังไม่ได้แก้ schema/Auth setting สองรายการนี้
- Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable และ https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Task 6 ยังไม่ปิด: production test data = ข้อ 2 ไม่อนุมัติ จึงไม่สร้างบัญชี/PO ทดสอบหรือทำ lifecycle writes; หลักฐานอัตโนมัติแยกจาก production
- Task 7 ยังไม่ปิด: backup/restore = ข้อ 3 ไม่อนุมัติ จึงไม่ dump/restore/สร้าง project หรือเปลี่ยนแผน; สิทธิ์ผู้ดูแล Dashboard ยังไม่ได้ตรวจ
- แนวทาง migration ครั้งถัดไป: สร้างไฟล์ด้วย `supabase migration new`, ทดสอบในฐานแยก, review SQL/สิทธิ์, ตรวจ remote migration list และ `db push --dry-run` ก่อน apply เมื่อได้รับอนุมัติ; หลัง apply ตรวจ Advisor และ metadata ซ้ำ ถ้าต้องแก้ให้ใช้ forward migration ที่รักษาข้อมูล ห้ามทดลองลบบน production


### ข้อ 1 เสร็จแล้ว — 2 ตุลาคม 2026

- ผู้ใช้อนุมัติให้ใช้ browser แทน connector และยืนยันตัวตนแล้ว; Dashboard แสดงบัญชี Perthyw, องค์กร Perthyw GRAND และ project rhkilsnuqdkzwlncjvkj
- ปิด “Allow new users to sign up” แล้ว Save changes สำเร็จ; UI แสดง switch ปิด
- ตรวจ GET /auth/v1/settings ด้วย publishable key ของ PO หลังบันทึก: HTTP 200, disable_signup=true, anonymous_users=false, email=true
- ข้อ 1 (ปิด public signup + deploy manage-user owner protection version 5) เสร็จแล้ว; ข้อ 2 production test data และข้อ 3 backup/restore ยังคงไม่อนุมัติ
- ค่า disable_signup=false ที่บันทึกก่อนหน้านี้เป็นผลก่อนแก้ ไม่ใช่สถานะปัจจุบัน ไม่มีการสร้างบัญชีหรือ PO ทดสอบเพื่อยืนยัน signup


### ผลหลังอนุมัติข้อ 2–3 — 2 ตุลาคม 2026

- ใช้ clean worktree จาก main b78a9379d4139706cfb7e0c425aadb8f3b6437cf; ไม่แตะ HR
- Production QA ใช้ Supabase Auth sign-in จริง owner/general/primary และ RPC จริง: VAT3000 (ฐาน2803.74 VAT196.26) + NONVAT3×50 หลายแผนก, lifecycle, reject reason, invoice gate, primary report, role/RLS, concurrent create/action retries, stale version, event/notification deduplication ผ่าน
- สร้าง PO-2026-000005–000008 ชื่อสินค้า/หมายเหตุมี QA Task6; ไม่มีการลบ PO หรือทดลองคืน production บัญชี QA 3 บัญชีปิด profile และ Auth ban; JWT เดิมอ่าน PO ได้รายการว่าง และ sign-in หลัง ban ถูกปฏิเสธจริง
- Harness รอบแรก 22/23 checks ผ่าน; owner protection assertion คาดข้อความผิด ไม่ใช่ระบบเปิดสิทธิ์ ทดสอบแยกซ้ำ 6/6 ผ่าน: owner by UUID/login ได้403 ข้อความตาม source, office list403, owner role/email/passwordเดิมไม่เปลี่ยน บัญชี QA เพิ่ม2บัญชีปิด/banแล้ว
- Endpoint QA ชั่วคราวถูกแทนด้วย function ไม่มี service access version4; POST ตรวจจริง410 ไม่คง QA privileged endpoint ไว้
- Excel จาก report production จริงใช้ dist/export.js และ bundled ExcelJS; เปิดไฟล์กลับตรวจ2ชีต/7รายการสินค้า ยอด/status/dept/unit/qty/VATตรงกับ report ผลผ่าน ไม่ใช่การคลิก download ใน browserจริง
- Migration20261002104506 revoke EXECUTE public.rls_auto_enable() จาก PUBLIC/anon/authenticated applyแล้ว; ตรวจ anon=false authenticated=false service_role=true, ensure_rls eventtriggerยังเปิด Advisorไม่เหลือ warningตัวนี้
- Remaining Advisor: po_commands RLS no-policy INFO เป็น intentional denial;4business SECURITY DEFINER RPC authenticated executeมี role guards/search_pathว่างตามflow; leaked-password protectionต้อง Pro+ ไม่เปลี่ยนแผน
- Git reachable34commits/128unique blobs และ production8assets HTTP200: ไม่พบ patterns sb_secret_, JWT service_role, GitHub PAT, private-key header ไม่ใช่การรับรอง secrets arbitraryทุกชนิด
- Dashboard org Perthyw GRAND Team:สมาชิก1คน current user Owner; MFA Disabled ยังไม่เปิดเพราะต้องผู้ใช้ตั้งปัจจัยยืนยันตัวตนเอง
- Production browserหน้าเข้าสู่ระบบ:Tabfocusเข้าสู่ช่องชื่อผู้ใช้ ไม่มีแนวนอนล้นที่1363px; consoleที่อ่านพบเฉพาะ chrome-extension metadata error ไม่มี errorจากPOในช่วงตรวจหน้าlogin ไม่ครอบคลุม flowหลังlogin
- สำรอง snapshot read-only7ตาราง consistentMVCC พร้อมsequence/schema metadata; isolated local restoreตรวจ rowSHA256/FK/columns/RLSตรง ไม่รวมAuthcredentials/sessions/Storage/settings
- ตั้งautomationสำรองapplicationทุกวันศุกร์เช้า Bangkok เริ่ม9ตุลาคม; ตั้งตรวจcapacityวันที่1ทุกเดือน warn350MB ไม่ลบข้อมูลอัตโนมัติ
- Task6ยังมี browserทุกบทบาท/keyboardmodal/fullresponsive/actualtimedJWTexpiryที่ยังไม่ตรวจครบ; Task7ขอบเขตfullAuth/Storagerecoveryยังไม่ตรวจ ห้ามใช้หลักฐานapplicationrestoreแทนfullbackup
- Forward migration:สร้างsupabase migration new, ทดสอบACLในฐานแยก, review/apply_migration, ตรวจremoteversion/Advisor/ACLหลังapply; rollbackใช้forwardmigrationที่รักษาข้อมูล หรือrestoreลงฐานแยกก่อน ห้ามDROP/truncateproductionทดลอง

- Supabase restore จริงใน project PO-restore-test-20261002 (tctartzpqrbxhkcgwmmu):7ตาราง hash/countsตรง source,10FK/policies/indexes/sequenceตรง;owner/primary8PO,disabled0;AuthUUIDplaceholders12ไม่มีemail/passwordและbanถาวร signuptargetปิด ไม่มีproductionrestore
- ผลสำเนาสุดท้าย:profiles12/departments14/POs8/items9/events24/notifications30/commands24 sequence8; fileSHA256 fae192a174e87e8fcde53421f9d829906aa0d8f79f2d3345f3848cef4401abc5
- BrowserAuth PO requestยังไม่ยืนยันsign-in แล้วผู้ใช้declinedการร้องขอถัดมา;หยุดการเข้าสู่ระบบและไม่กล่าวว่าทดสอบbrowserหลังloginแล้ว

- Owner login timeout report2026-10-02:บัญชีจริง roleowner/deletednull/bannednull/emailconfirmedtrue/passwordexists/emailmatchestrue;ไม่ได้resetหรือbanเจ้าของ Authhealth200และsyntheticinvalidcredentialtoken400ตอบประมาณ9.4วินาทีจากruntime;browserแสดงnetworktimeoutไม่ใช่invalidpassword เพิ่มเฉพาะlogin/token+profileเวลารอ45วินาทีจาก15 และข้อความnetworkAuth ไม่เปลี่ยนเวลารอPOwrites ยังต้องผู้ใช้ลองบนเครือข่ายจริงก่อนสรุปหาย


## Session and recovery follow-up — 3 October 2026

- User confirmed owner password recovery works. Treat the localhost redirect report as resolved according to user confirmation; no secret credentials captured.
- Re-ran test/session.test.mjs: passed. Mocked REST test covers persisted-session restore, refresh near expiry, preserving session on network error, and clearing disabled profile. This does not prove real elapsed JWT expiry on production.
- Actual timed JWT-expiry test remains deferred; no authenticated production session was used in this follow-up.
- Push notifications remain proposed and unimplemented; do not mark this feature complete.
