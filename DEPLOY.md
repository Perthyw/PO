# ขึ้นเว็บ PO The Grands

เว็บ production หลักที่ผู้ใช้ deploy คือ [https://po-thegrands.vercel.app/](https://po-thegrands.vercel.app/) โดยใช้ไฟล์ static ใน `dist/` ส่วน Sites URL เดิมเป็น release ก่อนหน้าแบบ owner-only

1. เชื่อม Supabase และ deploy Edge Function ตาม `SUPABASE-SETUP.md`
2. ใส่ Project URL และ publishable key ใน `dist/config.js`
3. ตั้ง Vercel สำหรับ static site: Framework Preset `Other`, Build Command ว่าง, Output Directory `dist` (โปรเจกต์นี้ไม่ต้อง build)
4. ตรวจให้ `app.js`, `api.js`, `domain.js`, `export.js`, `config.js`, `style.css`, `favicon.svg` และไฟล์ใน `vendor/` โหลดได้
5. Edge Function `manage-user` ต้องอนุญาต origin `https://po-thegrands.vercel.app` ใน `ALLOWED_ORIGINS`; ปัจจุบันตรวจ preflight จาก origin นี้แล้ว
6. ก่อนเปิดใช้จริง ให้เจ้าของทดสอบ login, ขั้นตอน PO, เมนูจัดการบัญชี และดาวน์โหลด Excel บนเว็บ Vercel

เว็บไม่มี server secret ข้อมูลจริงอยู่ใน Supabase ของ project นี้ โหมดสาธิตไม่ใช่ที่เก็บข้อมูลจริง


## Review before production

### Current incremental preview: request selected item revisions
The original PO detail now adds `ส่งคำขอแก้ไข` for the creating office account on pending/approved POs. Selecting items and a required reason saves a separate browser-local request without changing the PO number, status, items or prices. A pending request is visible to the owner and creator and holds this PO's lifecycle actions. Owner processing/unlock/edit/resubmission are not implemented in this iteration. Generated app/API suffixes load `preview-revision-requests.js`; production output excludes it. The baseline guarantees below continue except for this explicit request-only extension.

Work on a separate branch and review its Vercel Preview URL. Do not merge to main until the owner explicitly approves production publication. `vercel.json` prepares `web-build/`; Vercel Preview builds create an empty Supabase configuration and use the original `index.html`, `app.js`, `style.css`, `api.js`, and `domain.js`. Only generated `app.js` and `api.js` have known local-storage key literals changed to the `po-the-grands-preview-baseline-v1-` prefix. Generated `api.js` seeds two public synthetic accounts only if the new account key is absent: username `owner` or `office`, password `DemoOnly123!` for both. An existing account value, including an empty list, is preserved. These credentials are for this browser-local demo only and do not work against production. The preview retains the original whole-PO lifecycle and adds no synthetic role-switch controls, partial decisions, revision workflows, or custom preview UI. Custom preview modules/styles and the mobile harness are omitted from preview and production output. Source configuration and production files remain unchanged.

Preview data are synthetic and remain in the current browser. The baseline Node runtime test verifies owner/office login, create → whole-PO approve → receive → invoice close, report-total change, namespaced persistence, untouched legacy-key sentinels, and no network calls. Browser QA for the newly published baseline is pending and limited to inspecting the original login screen and inactive-feature omission; credentials are not entered. This preview does not verify Supabase Auth, RLS, Edge Functions, shared accounts, push notifications, or multi-device synchronization. Existing restore-test projects containing restored production records must not be used for interactive preview. A separate synthetic-data staging backend remains required for full integration testing.

To check the preview build locally: `VERCEL_ENV=preview node scripts/prepare-deploy.mjs`. After approval, merge the reviewed branch into main. Database migrations require a separately reviewed deployment and are not applied by this build script.
