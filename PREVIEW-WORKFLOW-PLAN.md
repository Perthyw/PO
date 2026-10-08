# Active incremental request-only contract — 7 October 2026

User now authorizes only adding `ส่งคำขอแก้ไข` to the original office PO detail. Clicking reveals item checkboxes in the existing table; creator selects one or more items, supplies a mandatory reason and submits or cancels. This extends the isolated baseline below and does not revive previous revision/partial approval features. Production source/main/Supabase remain unchanged.

- Creator office may request own pending/approved POs only; primary office cannot request someone else’s PO. Received/closed/rejected POs deny request. Preserve original PO id/number/status/items/prices.
- Placement update (2026-10-08): put the button in the bottom-right actions row of the original สถานะใบ PO panel, below the tracker. Put each compact checkbox directly before the item name on the same line in its existing first cell, with an accessible label and no duplicate visible selection text. Use original native dialogs, field/error/focus/pending helpers. Show a concise saved request with selected names/reason/time to creator and owner; add no unlock/edit/reapprove/partial decision controls.
- Store immutable selection snapshots/index identity and PO version in a separate baseline-prefixed request namespace. Validate against latest original service data, stale version/snapshot, actor and one-active-request-per-PO before saving. Invalid/cancelled/failed writes must leave request/order storage unchanged. Repeated command returns the same record only after authority validation; no duplicate requests.
- Generated preview app extension and passive module only. Original source app/api/style/index/config/domain remain protected. Keep baseline account/data namespace and every earlier browser namespace intact.
- Required evidence: generated API plus real generated-app DOM click test, multi-selection/reason validation/cancel, creator/owner visibility, reload persistence, actor/stale/duplicate/write-failure denial, full original PO equality and no network; clean production build excludes extension. Root-confirmed operational hold: a saved active request blocks all original lifecycle mutations on that PO (approve/reject/receive/close), while original status and item values remain intact. UI explains the request is pending; service guards direct calls too. Selection can be cancelled before submission; submitted requests have no processing/withdrawal action in this iteration. Other POs are unaffected. Owner processing is explicitly the next user-directed step, not implemented now.

## Request-only implementation review — 7 October 2026

Supervisor approves this scoped extension for preview publication. Worker reported 107 passing tests and syntax/diff checks. Supervisor independently passed six request/build/runtime tests and reran the actual generated-app jsdom harness using the existing test runtime (no dependency added): two real item checkboxes, missing-reason and empty-selection field focus/aria validation, cancel without a request write, both-item submission, owner reload/login visibility and disabled owner lifecycle controls. The request persisted once; original PO remained pending with original identity and item values unchanged.

Review confirms submit uses original global pending helper plus actor/route/load-sequence checks before storage write; corrupt/unreadable request storage renders an error and disables lifecycle controls. Generated API blocks direct lifecycle actions on the requested PO. Production app/API/style/index/config/domain remain unchanged, and production build omits the request module. This verifies only selection/request submission and the explicit hold; owner processing/unlock/edit/reapproval remain unimplemented. Browser verification for this new extension is pending.

---

# Baseline contract (still applicable except explicit request extension)

# Active baseline reset contract — 7 October 2026

This section supersedes every revision/partial/estimated workflow approval below. User now requests the original baseline so they can direct subsequent changes. Keep original production UI and original whole-PO demo behavior, with no revision, unlock, partial-decision, synthetic scenario or replacement UI controls. Historical feature sources and review evidence remain retained; no existing browser data are migrated, inspected or cleared.

## Implementation boundary

Only the generated Vercel Preview bundle changes routing/configuration and known storage-key literals. Preview loads original index/app/style/api/domain/export. Generated config is blank for Supabase. Generated api.js additionally contains a build-only synthetic account initializer; generated app.js/api.js replace every original browser-storage key with a new `po-the-grands-preview-baseline-v1-` namespace, including accounts, orders, departments, notifications, reset marker and session. No global storage monkeypatch and no reading/removing old namespaces. Source production files remain unchanged. All custom workflow/adapter/app/styles/fixtures/bootstrap modules are omitted from generated output; their source/history may remain in git. Clean production build removes preview leftovers and preserves original files exactly.

## Baseline interaction and review checklist

- Preserve original login/setup/account-switch screens, sidebar, five status cards, PO create/review/detail tracker, form fields, native dialogs, report and Excel. Generated preview API seeds public synthetic owner/office accounts only if the new baseline account key is absent; existing baseline accounts are never overwritten. Original login stays unchanged. Documented users are `owner` and `office`, public demo password `DemoOnly123!` for both; office is primary for report review. Original final demo account implementation accepts six-character minimum passwords. Original demo-office seed hiding remains original behavior.
- Original whole-PO transition is authoritative: pending → owner approve/reject with original reason rules → office goods receipt → owner invoice acknowledgement/close. Do not inherit per-item revision, partial approval or item-level report eligibility from prior preview.
- Generated-file tests compare original app after only explicit key substitutions and API after explicit substitutions plus the agreed seed initializer; style/index/domain/export remain canonical. Exercise original demoAuth/create/action using isolated generated API, prove all observed storage keys belong to new baseline namespace and seeded old keys remain byte-identical. Check full-PO report totals and original role/confirmation gates.
- Full test/syntax/diff checks and source production diffs precede provisional preview publication. Parent publishes preview branch only and browser-verifies original login rendering and inactive-feature omission. Seeded login and whole-PO lifecycle are verified by Node runtime tests; browser credential entry and lifecycle verification are not performed. No production/Supabase/main authorization.

## Baseline implementation review — 7 October 2026

Supervisor accepts the baseline implementation for preview publication. Parent full suite passed 104/104, syntax and diff checks passed; supervisor independently reran all three baseline build/runtime tests successfully. Generated app equals original app after six explicit storage-key substitutions; generated API equals original API plus those substitutions and the absent-key-only synthetic seed. Original index/style/domain and production files remain canonical. Generated outputs omit previous custom preview modules/styles/harness. Runtime test proves public synthetic owner/office login, original full-PO create/approve/receive/invoice-close/report/persistence, no network calls, namespace-only reads/writes, legacy sentinels unchanged, and existing baseline accounts (including an empty list) preserved.

Browser verification for the newly published baseline is still pending and is limited to original login rendering and inactive-feature omission; no credential entry or browser lifecycle claim is authorized. Prior feature browser tests below are historical. Production/main/Supabase remain untouched and unapproved.

---

# Historical contracts and acceptance (superseded by baseline reset)

# Active revised preview contract — 6 October 2026

This section supersedes all workflow/design approvals below. The earlier per-item/estimated-price preview is historical evidence only. Explicit current user instruction is authoritative: preserve the original production UI, remove estimated-price concepts, make whole-PO approval the normal action, keep partial decisions as an explicit secondary mode, and finish Excel export.

## Authorized scope and implementation

- Production `dist/app.js`, `style.css`, `domain.js`, `api.js`, `config.js`, `index.html`, Supabase migrations and edge functions remain unchanged. No main merge or production deploy.
- Preview UI must faithfully reuse the original sidebar/topbar/logo/identity placement, five PO status metrics, list/order tracker, table, detail document, create/review form, report, dialogs, Thai labels and responsive layout. Use the original markup/classes/helper ownership as implementation source; do not restyle the previous custom preview dashboard. Preview-only synthetic role/scenario/reset controls must be small additions to the existing shell.
- Use existing `style.css` without new alternate palette/layout. Limit extra preview CSS to necessary item decision/revision controls and demo notice. Preserve original query-state pagination, form arrow navigation, field validation, dirty guards, focus, modal behavior and THB/VAT presentation.
- All item prices are actual confirmed prices. Remove estimated-price selector, budget approvals, budget metrics, explanatory copy and budget workbook columns. Use a new versioned preview namespace and visibly reset old synthetic estimated scenarios; never interpret a prior budget authorization as a purchase approval. Existing production/demo/session storage must not be read, converted or cleared.

## Normal and exceptional lifecycle

1. Office creates and reviews a PO using original fields. Owner default primary action is **อนุมัติทั้งใบ PO**. Execute as one atomic command with one PO version/idempotency identity; approve eligible pending rows together and retain per-item immutable audit attribution. A failure on any target makes no changes.
2. **อนุมัติบางรายการ** is the explicit secondary mode. Only in this mode expose per-item approve, return-with-reason or terminal reject-with-reason controls. Do not put per-item decision grids in the normal approval path. Independent approved rows can proceed to receipt while other rows remain unresolved.
3. Creator office requests item revision from pending or approved state with mandatory reason; no direct edits to submitted pending rows. Item is immediately paused against purchase/receipt. Owner may refuse with reason and restore exact prior pending/approved state, or unlock the specific item. Creator edits only unlocked/returned rows and resubmits for fresh approval, preserving department/name/spec/source/quantity/unit/actual price/payment/VAT/note and immutable before/after/amount delta audit. Received items/closed POs immutable. Primary office may view/report/receive others' approved rows, but money authoring belongs only to creator.
4. Original normal tracker remains request → approved/waiting goods → received/waiting invoice → closed. Mixed states must have truthful contextual explanations and do not claim all goods received. Per-item receive requires acknowledgement; owner close requires all live rows received and invoice acknowledgement. All-rejected PO resolves rejected.
5. Root-confirmed bulk gate: whole approval is available only when every live unreceived row is pending or already approved, with at least one pending target. If returned/editing/revision-requested rows remain unresolved, disable it, explain why and offer explicit partial mode for ready pending siblings. Never silently approve a pending subset under a whole-PO label. Normal receipt may use an atomic whole-goods acknowledgement when all live unreceived rows are approved; independent per-item receipt is secondary for partial cases.

## Excel completion and evidence gates

- Original monthly report layout and summary/item workbook structure retained. Monetary eligibility is actual approved/received/closed item totals even within mixed POs; unresolved/paused/rejected rows excluded. Preserve PO/item status, requester, department, original author fields and base/VAT/gross amounts. No estimated/budget columns.
- Generate a real XLSX with workbook parsing tests; retain the visible native Blob download link until replacement/navigation. Success copy says file ready, not downloaded. Verify actual browser download if available; report observer limitation accurately if still unverified.
- Required regressions: atomic whole approval, secondary partial mode, only actual prices including old demo reset, creator request/owner unlock/fresh approval, refusal exact restore, stale version/durable dedupe/action-role guards/storage rollback, preserved form fields/multiline radios, mixed monetary summaries and XLSX, receipt/close invoice gates, original UI parity desktop/390px and dirty/modal keyboard recovery.
- Supervisor provisional preview-deploy approval follows complete diff/domain/build/XLSX checks; root handles GitHub/Vercel and browser evidence. Final approval distinguishes synthetic demo evidence from Supabase production and records any export limitation. Previous approval below does not approve the revised implementation.

---

# Historical plan and review evidence (superseded)

# Per-item PO workflow preview plan and approval checklist

Authority: explicit user-approved preview proposal, 5 October 2026. This document describes an isolated demo extension. PRODUCT.md and production Supabase contracts remain authoritative for production; this preview does not implement production RPC, schema, RLS, Auth or deployment changes.

## Scope and implementation order

1. Add explicit preview entry route/module and synthetic local-only data. Preserve normal configured Supabase entry, api.js production adapter, config, migrations and edge functions. Preview must clearly say data are synthetic/browser-local and actions do not affect real POs.
2. Implement a pure per-item state machine and preview service, with stable item identity, PO version, actor authorization, immutable events, command identity/fingerprint and integer-satang calculations. Validate authorization before returning cached command results. Cross-item actions must preserve unrelated data.
3. Implement Thai list/detail/create/edit/review/report/export screens using established style.css tokens, field/errorField, native dialog, pending controls and status semantics where technically reusable. Reuse existing validated financial helpers; do not silently rewrite production components.
4. Add deterministic synthetic scenario fixtures and tests, then supervisor review. Root owns browser evidence, GitHub commit and preview deployment; no main merge or production publish.

## State and permissions contract

| Action | Actor | Allowed item state | Result and gate |
|---|---|---|---|
| Approve | Owner | pending | confirmed price -> approved; estimated price -> budget_approved, named “อนุมัติวงเงินประมาณการ” |
| Return for edit | Owner | pending | returned; mandatory reason; retain every original field |
| Reject | Owner | pending | rejected terminal; mandatory reason |
| Resubmit returned item | Creator office only | returned | pending; same identity, new validated fields and immutable before/after audit |
| Submit confirmed price | Creator office only | budget_approved | pending with confirmed price; fresh owner approval required |
| Request revision | Creator office only | approved or budget_approved | revision_requested immediately pauses purchase/receipt; mandatory reason, approved snapshot retained |
| Unlock requested revision | Owner | revision_requested | editing; only requested item can change |
| Return approved item directly | Owner | approved or budget_approved | editing; mandatory reason, pause authorization, preserve approval snapshot and require fresh approval |
| Refuse requested revision | Owner | revision_requested | restores previous approved/budget_approved state; reason recorded |
| Submit unlocked revision | Creator office only | editing | pending; before/after and monetary delta audit; fresh approval required |
| Receive item | Creator office; primary office can receive any visible PO | approved with confirmed price | received; explicit confirmation; estimated prices and paused/editing/pending/rejected items blocked |
| Close PO | Owner | every item received or terminal rejected, at least one received | closed only with invoice checkbox; all-rejected PO resolves to rejected without invoice/close action |

Regular office can access only own POs; primary office can access all, receive others’ confirmed approved items and export combined reports, but cannot edit/resubmit/request revisions for others; owner can inspect/decide, cannot use office report capability. Received items and closed POs are immutable. Pending decisions on one item do not block confirmed approved siblings from receipt. Returned/editing/revision_requested items are unresolved and block whole-PO closure. Rejected rows remain visible for history and are excluded from authorized/purchase totals. No hard deletion of submitted rows.

## Financial and status contract

- Entered unit price includes VAT; integer satang, per-line half-up VAT 7/107; existing quantity/unit/payment/department/spec/vendor/note/date fields survive edit.
- Separate submitted total, budget authorization, confirmed approved purchase total, received total and rejected total. Estimated authorization never appears as confirmed ordered spending.
- List/detail/monthly report/export derive values from the same per-item eligibility logic. An approved sibling in a mixed PO must count even when other rows remain pending/returned/rejected. Revision-paused rows must not count as currently purchasable.
- Aggregate PO status must never hide unresolved rows or claim received/closed while a live row is unresolved. Detail prominently shows all item states and available next actions. Mixed state is explicitly explained.
- Every event includes item identity, actor, action, exact timestamp, reason when required and affected revision. Editing audit includes complete old/new snapshots plus old/new amount and delta, even when amount is unchanged. Old approvals/history remain immutable.

## Canonical UI ownership and review criteria

Established Thai product/admin UI, Tahoma/Leelawadee, blue/cream/wine palette and document/table scroll ownership remain unchanged. Existing native form/date/radio inputs own entry; native dialog owns focus/Escape/inert background; global style.css owns scrollbars; shared status/live-region conventions own feedback. Preview table and editing variants must be named and isolated. Forms preserve input on error, focus first invalid field, label every control, disable duplicate submits and provide conflict reload. No whole-page horizontal overflow on phone; table horizontal scroll allowed. Explicit item name/PO identity in consequential dialogs. Preview role switch is visibly demo-only.

## Required synthetic scenarios and evidence

- Pending confirmed, pending estimated, returned with reason, rejected with reason, budget_approved, approved confirmed, received, closed with invoice.
- Mixed PO containing independently approved/received/pending/returned/rejected rows; all-rejected PO; revision requested, unlocked edit, fresh pending approval, approved revision; refused revision restores prior authorization.
- Empty/invalid reason, invalid monetary/edit field and missing payment choice; fields retained after correction and cancel; received mutation attempts denied.
- Estimated approval -> receipt blocked -> confirmed price -> fresh approval -> receipt -> invoice close; closure blocked for unresolved rows and absent invoice.
- Owner/regular office/primary office/outsider permission matrix, unauthorized direct-service commands, stale PO version, duplicate identical command including after reload, same key with altered payload/actor, returned snapshots immune to caller mutation; owner direct approved-item return with reason.
- Mixed VAT/NON VAT, monetary increase/decrease/unchanged revision; expected totals reconcile list/detail/report/workbook. Reports and Excel expose item state/price kind/revision and distinguish budget from confirmed amounts.
- Reload persistence and isolation: preview actions survive where promised without affecting normal demo or production/session stores. If multi-tab persistence is supported, stale snapshots must not overwrite changes.

Acceptance requires npm test and npm run check passing, focused preview tests proving the above domain/service/export gates, reviewer inspection of the complete diff, and separate browser evidence of desktop/narrow Thai UI and full representative flows. Static/unit demo proof must never be described as Supabase production proof. Record omissions honestly before approval.

Build boundary: enable only an explicit generated `config.previewWorkflow === true` flag in preview output. `dist/config.js` remains unchanged. Normal configured boot must not construct the preview adapter or seed preview stores. URL query parameters alone cannot enable this mode.

## Supervisor review — provisional preview deployment gate

GPT-6.1-sol inspected the independent lifecycle/service, synthetic fixtures, Thai UI/action routing, workbook generation, build isolation and targeted regression tests. Initial review blockers were returned to the implementation worker and corrected: estimate purchase bypass, unchecked receipt, role/cached-command guards, create idempotency, snapshot mutability, storage rollback, receipt/closed financial totals, multi-item form serialization/radio grouping, stale edit versions, role/draft navigation, hidden item actions and export consistency.

Independent focused verification passed 13/13 tests, including parsing the generated XLSX and preview-to-production output cleanup. Independent service probes also passed pause/refusal restoration, fresh confirmed-price approval, quota-write rollback and stale service-instance checks. Worker reports the complete suite at 100/100 and syntax/static checks passing; root will independently confirm those before commit.

Provisional approval is limited to committing the preview branch and deploying its preview for browser testing. Final approval requires the representative browser flows and narrow-screen checks below. This is demo evidence; it does not establish production Supabase Auth/RLS/RPC/multi-device behavior. No merge to main or production deployment is authorized here.

## Final supervisor decision — preview workflow approved with export verification limitation

Reviewed deployment: `b18b0679487962d71cea508b2ad326d6f8eb6429` (Vercel preview succeeded), following the original browser-tested implementation at `f8667482fc75aae20cc71ec659894449a88a3b64`. GPT-6.1-sol approves the core per-item demo workflow for user preview review. This decision does not approve a merge to main, production publication, or a Supabase implementation.

Root's live-browser evidence covered confirmed per-item approval independent of estimated siblings; estimated budget approval blocking receipt; confirmed-price submission and fresh approval with a +190 THB delta; independent receipt with checkbox acknowledgement; required return reason and preserved field editing with a -50 THB delta; revision request immediately pausing receipt, owner unlock and fresh pending approval with a +120 THB delta; refusal restoring the prior approval; direct owner return of an approved row while a received sibling remained unchanged; invoice-gated close and immutable closed detail; two-item create/review/back preserving independent credit/cash, VAT/NON VAT and estimated/confirmed choices; primary-office denial of another creator's edits; and report reconciliation excluding unresolved/rejected/budget rows.

The live 390×844 iframe check showed dashboard/detail/edit with document client width equal to scroll width (380 CSS pixels within the 390-pixel viewport), and a contained dirty-navigation dialog. Cancel/Escape restored focus and retained unsaved supplier text; explicit discard restored saved data. These are representative browser checks, not a claim of every browser/device combination.

Automated evidence: worker and root report the final complete suite at 101 passing tests, syntax checks passing and strict design audit with zero findings; supervisor independently ran the focused lifecycle/build/XLSX tests before the final download patch and reviewed the final patch and additional Blob/filename/no-auto-revocation test. Generated XLSX bytes were parsed in automated tests and reconcile the report's item eligibility, budget, tax and amount columns.

**Export browser limitation:** the final preview generated a visible native download link with a Blob URL and `.xlsx` filename and displayed “ไฟล์ Excel พร้อมดาวน์โหลด”. Root's DOM/native-anchor download observers timed out and did not yield a downloaded file. No application error was observed, but actual browser download completion is unverified. The cause is not established. Do not claim that browser Excel download passed. The persistent link remains available for the user to try; generated workbook content has automated parsing evidence.

All records/actions reviewed here are synthetic browser-local demo behavior. Real Supabase Auth, RLS, RPC, account permissions, notifications and multi-device behavior were not validated by this preview and require their own implementation and integration review.

## Historical export limitation resolved — 6 October 2026

Root subsequently observed a real download from the previously deployed preview's visible native Excel link, retrieved a 10,966-byte XLSX and parsed its two worksheets (`สรุปทดลอง`, 6 rows × 2 columns; `รายการสินค้า`, 21 rows × 22 columns). The workbook summary total of 8,890 THB matched the displayed browser report. This supersedes the earlier unverified-download limitation for that prior deployment only. No cause for the prior timeouts is established. The new actual-price/original-UI revision requires its own workbook and browser verification.

## Current revision supervisor predeployment review (2026-10-06)

Static/domain review confirms actual-only item prices; atomic whole-PO approval and receipt gates; explicit partial decisions; creator requests from pending or approved, owner unlock/refusal and fresh approval after editing; primary-only aggregate report; isolated v2 storage and generated preview assets. Independent supervisor probe verified pending → request → refusal restores pending and its exact amount. Worker reported 99 passing tests and syntax/diff checks, including parsed XLSX and notification routing/deduplication. Production application/style/config/index remain unchanged.

This is evidence for provisional preview publication for browser testing, not final browser acceptance or production approval. The new original-shell build still requires live desktop/mobile parity, whole and partial flows, dirty-edit navigation, notifications, and a real downloaded workbook reconciled against its report. Prior-build download evidence above does not satisfy the new build gate.

### First live original-shell review and targeted correction
Parent browser-tested preview commit `3820cec`: original sidebar/five status cards loaded, whole approval → acknowledged receipt → invoice close passed, and explicit partial toggle exposed row actions. Live review identified request summary incorrectly showing eligible zero for pending rows and missing item status for real item names. Targeted patch restores all-current-item request subtotal/VAT/net, displays a separately labelled approved/received purchase amount, and adds Thai status beneath each detail item name while preserving original table columns. It also removes duplicated action names and corrects report eligibility copy. Supervisor independently passed 11 workflow/UI-contract tests. Patched browser evidence remains pending; this is provisional preview approval only.

## Final current-scope preview acceptance (2026-10-06)

Supervisor approves the synthetic preview workflow on browser-tested commit `5af9` (parent-reported abbreviated commit), subject only to the already-approved final review-note wording and evidence commit. The 102-test suite, syntax checks and clean diff checks passed before deployment. This acceptance covers the actual-price-only original-shell preview; earlier estimated-price approvals are historical.

Parent live browser evidence:
- Original sidebar/navigation and five status cards retained. Whole approval, acknowledged whole receipt and invoice close completed for DEMO20101. Explicit partial mode exposed item actions; partial return DEMO20107 and independent approval DEMO20110 retained sibling state.
- Approved item request → owner notification → unlock → creator notification → supplier/price edit from 890 to 950 → review at 1,900 → fresh pending submission → fresh approval passed. Dirty back/cancel kept entered data. Pending request/refusal restored DEMO20112 exactly to pending and 360.
- Patched detail correctly distinguished full request and report-eligible totals: pending 360/eligible zero; mixed 830/eligible 550. Actual item names show Thai item states.
- A real native-anchor XLSX download produced 10,854 bytes, independently parsed with bundled ExcelJS: `สรุปรายเดือน` 8×2 and `รายการสินค้า` 22×19. Summary B5 was 16,228, matching the browser report; eligible rows summed to 1,622,800 satang. Revised DEMO20104 retained unit price 950, gross 1,900 and edited supplier. New pending DEMO00013 had gross 214 and eligible zero. No estimated/budget columns remained.
- The 390×844 inspection iframe retained original horizontal navigation, two-column status cards and complete native form fields. Quantity 2 at 107 VAT-inclusive gave base 200, VAT 14 and gross 214; create/list/new item state passed. Document client and scroll widths were both 380, showing no page overflow. Native approval dialog was 342×350.7 at x19/y246.6, within viewport; initial focus was least-destructive กลับ. Escape closed it and restored focus to อนุมัติทั้งใบ.

Final limitation/boundary: this is browser-local synthetic preview acceptance only. It does not approve or verify Supabase authentication/RLS/API/database integration, shared accounts, push notifications or multi-device synchronization. Original production app/style/config/index and backend/schema remain unchanged; no merge to main or production publication is authorized by this acceptance.
