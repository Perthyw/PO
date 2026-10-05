# PO The Grands UX contract

Business authority: PRODUCT.md (2026-09-25 explicit user request). Supabase setup and storage contracts: SUPABASE-SETUP.md and supabase/migrations/20260929000000_initial_po_schema.sql. New independent app, no sibling legacy workflow to inherit.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | field(), errorField(), validateItems() | PRODUCT.md | create/review/login/reason | domain tests + browser |
| Scrollbar | dist/style.css global baseline | DESIGN.md | page/table/modal | narrow browser inspection |
| Toast | notify() and #toast live region | this contract | success only after committed result | browser |
| CRUD | api.js, create_po(), act_on_po(), manage-user | PRODUCT.md + current user decisions | PO lifecycle and owner-managed office accounts | database/API tests |
| Dialog | openModal() native dialog | this contract | confirm/reason/discard | focus/Escape/browser |
| Date | PostgreSQL now(), domain.date() | PRODUCT.md | display only; no picker | database + browser |

Select/Listbox and Table Selection are not applicable (no dropdown or bulk selection).

## Flow ledger

- Open PO → validate → review → submit → list and success status. Back to edit keeps values. Each item requires its own active department/branch and a free-text unit; both are preserved in PO detail and Excel. Source PRODUCT.md.
- “รวมก่อน VAT” sums only the extracted base of items marked VAT 7%. NON VAT items remain in the grand total but are excluded from this VAT-base figure.
- Approve/reject/receive/close → object-specific dialog → pending disabled buttons → authoritative RPC → refreshed detail and success status. Source PRODUCT.md.
- Reject requires reason; receive and close require explicit checkbox; close only after receipt. Owner alone closes. Source PRODUCT.md.
- Failure keeps review/dialog and values with inline error/retry. Timeout retry uses same UUID. Changed version requires refresh. No silent retry under a new identity.
- Create key changes when draft changes; repeat submit of identical draft is idempotent. Action keys are stable while dialog stays open.
- Tables/PO list use server pagination of 10. Status/page persist in query parameters; reset page on filter changes. API has explicit count; no partial client filtering. Filter and scope changes retain the application shell and control elements while results refresh. Always show all five PO status summary cards, including rejected, and update their counts; keep the list heading/refresh control and filters visible when the filtered result is empty, hide only the paginator, and retain the office “เปิดใบ PO” empty-state action.
- A PO status badge uses the corresponding status summary card palette. The next upcoming step in the tracker always has a red outlined circle; completed steps use the shared blue workflow-completion color.
- On the monthly report, the “ไม่อนุมัติ” summary card uses a pale-red surface and border to mark rejected POs.
- Drafts stay in memory. Warn on in-app navigation and beforeunload. Reauthentication preserves draft only for same account. Production keeps no browser-persistent session or PO records.
- Demo uses browser-local storage and DEMO identifiers so newly created POs survive page reloads on this machine; production cannot switch roles in UI and never falls back to demo on failure.
- A regular office account sees only the PO records it created. The primary office account and owner see all staff PO records; the primary office account can switch the list and status totals between “ทุกคน” and “เฉพาะของฉัน”. Owner manages office accounts. Office login uses a unique readable account name such as `ชื่อบัญชีที่เจ้าของกำหนด`. Office passwords may use letters or numbers and contain at least six characters.
- The owner account form asks only for a login name and password; the login name is also the visible requester identity. Monthly reporting is an explicit primary-office-account capability. Only an active office account with `can_export_report=true` can manage departments/branches and see, load, or export the combined report across all purchasing staff. The owner manages this capability and does not access the report.
- Archiving a department requires a confirmation dialog. Archived names remain on old PO items but cannot be selected for new items. A regular office account can confirm receipt only for its own PO; the primary office account can confirm receipt for any PO.

- Monthly summary reloads immediately when office staff select a month. Export always uses the month and data currently displayed; there is no separate “ดูสรุป” confirmation step. The workbook contains the monthly summary and one product-detail sheet; product rows include PO number, requester, department/branch and current PO status.
- Workflow notifications are created for every committed lifecycle action. Create and receive notify active owners; approve, reject and close notify the office account that created the PO. Opening the notification panel marks visible notifications as read, and every notification links back to its PO detail.

## Locale, accessibility and recovery

Thai labels, Thai dates and Bangkok timezone, two-decimal THB. Native operating-system text/number/checkbox inputs; no authored picker. Semantic buttons and tables. Visible keyboard focus. Modal focus trap/inert background via HTML dialog; restore focus when opener survives. Screen-reader text on completed progress steps. Error feedback role alert, success role status. Global scrollbar visible; no whole-page horizontal overflow. No speculative legal copy or payments.

At small laptop widths (1100px and below), dashboard metric cards reflow to two columns and the sidebar wordmark wraps inside the navigation rail. At phone widths (700px and below), retain two-column metrics and use compact horizontal navigation.

## Verification

test/database.test.mjs tests real PostgreSQL behavior in isolated PGlite with a mocked Supabase auth.uid/session boundary. This is not a real Supabase integration test. test/domain.test.mjs tests money and state rules. VERIFICATION.md records exact checks and browser coverage; missing external integration remains explicit.


## Owner account settings

Source: explicit user approval 2026-10-02. Reuse field(), passwordControl(), errorField(), withPending(), notify() and openModal() on the owner-only บัญชีของฉัน route. Separate alias and password forms require current-password proof; preserve values on failure, clear committed passwords on success, and never persist password drafts. Guard unsaved navigation. Alias update stays on the settings page; password update clears the local session and returns to signin with success feedback. Public alias signin returns tokens only after Auth password verification, never an unauthenticated email mapping.


## Owner recovery

Capture and remove callback URL secrets before session restoration. Validate Auth identity and active owner profile. Use existing masked controls, field validation, pending guards and generic notices; invalid links offer a new request. Never expose recipient email. Refresh after URL cleanup needs a new link.


## Per-item payment choice (2026-10-03)
`lineForm` owns each item's native เครดิต/เงินสด radio group. New items require an explicit selection before review; missing selection shows an inline group error and focuses the first radio. Changing selection updates the draft and command key like other item edits. Separate item groups preserve independent choices across rerenders. Shared `itemsTable` owns the การชำระเงิน column in review and detail; monthly Excel uses the same labels. Legacy missing values display ไม่ระบุ. This metadata does not change totals or lifecycle permissions.

## PO arrow navigation
`navigatePOForm` in `dist/form-navigation.js` owns optional arrow-key navigation for the create form. Left/Up move backward at the start of text; Right/Down move forward at its end. Number fields move directly. Preserve selections, IME composition, modified shortcuts and native date/radio/checkbox/datalist behavior. Skip unavailable controls, do not wrap or submit, and retain standard Tab navigation. Login username has a visible label and no example placeholder.

## Isolated per-item approval preview (2026-10-05)
Business and lifecycle authority: `PREVIEW-WORKFLOW-PLAN.md`. `dist/preview-bootstrap.js` is selected only when the preview build generates `config.previewWorkflow === true` with empty Supabase credentials. Production continues to load `dist/app.js` directly; its authentication, API, and database contracts do not inherit preview behavior.

Preview-only UI variant: `dist/preview-ui.js` reuses the Thai product palette, native labelled fields, native dialog, status text and visible scrollbars. Synthetic role buttons, scenario picker and reset control are demo affordances only; they do not represent production authorization or credentials. The persistent notice says data are synthetic and browser-local. Preview mutations use a separate local-storage namespace and the independent item workflow in `preview-workflow.js`.

The preview list and detail show item-level status and amounts. Owner decisions apply to one item; office revision forms preserve all author fields and show immutable before/after snapshots and satang deltas in the history. Estimated-price authorization is shown separately from confirmed purchases. The preview report and workbook use the same eligibility rule: confirmed-price items that are approved or received count toward purchase value; estimates, pending, paused, rejected and returned rows do not. Close confirmation requires an invoice acknowledgement and a resolved PO; closed items expose no mutation controls.

At narrow widths, preview tables own horizontal scrolling, forms and detail content retain natural page height, and all actions remain visible. `mobile-check.html` exists only in the generated preview build as a 390×844 inspection harness and is removed by the next clean production build.
