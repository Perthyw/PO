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
