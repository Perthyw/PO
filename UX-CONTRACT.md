# PO The Grands UX contract

Business authority: PRODUCT.md (2026-09-25 explicit user request). Supabase setup and storage contracts: SUPABASE-SETUP.md and supabase/migrations/20260929000000_initial_po_schema.sql. New independent app, no sibling legacy workflow to inherit.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | field(), errorField(), validateItems() | PRODUCT.md | create/review/login/reason/owner edit/item decision | domain tests + browser |
| Scrollbar | dist/style.css global baseline | DESIGN.md | page/table/modal | narrow browser inspection |
| Toast | notify() and #toast live region | this contract | success only after committed result | browser |
| CRUD | api.js, create_po(), act_on_po(), unlock_po_edit(), edit_po_items(), decide_po_items(), manage-user | PRODUCT.md + current user decisions | PO lifecycle, owner item edits and decisions, owner-managed office accounts | database/API tests |
| Dialog | openModal() native dialog | this contract | confirm/reason/discard | focus/Escape/browser |
| Date | PostgreSQL now(), domain.date() | PRODUCT.md | display only; no picker | database + browser |

Select/Listbox remains platform-native where used. Item rejection uses native checkboxes in the existing command dialog; selection is limited to the pending PO's stable line numbers, never a page or all-results selection.

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

## Owner edit and item decisions

Business authority: PRODUCT.md, “Owner edits and item decisions — approved scope, 9 October 2026”. Preserve existing Thai visual tokens, layout and shared field, error, modal, pending and toast primitives.

- Owner detail → padlock unlock → enabled edit action → existing modal variant → save through authoritative RPC → refreshed detail and committed success feedback. Unlock tokens stay in memory; cancellation, successful save, navigation or actor changes restore locked UI. Database role/state/version validation applies even when the API is called directly.
- Owner unlock/edit controls sit at the right of the product panel heading above the accepted item table, rather than the lifecycle panel.
- The edit modal fits its available width without horizontal scrolling; fields and fieldsets may shrink and number controls wrap on narrow screens. Long forms retain vertical scrolling and a sticky top-right ×. ×, cancel and Escape share the same unsaved-change guard; continue editing preserves the draft, discard closes and restores focus. Pending writes block dismissal. Failures retain input and show inline recovery guidance.
- Native controls expose labels and group errors. Existing unspecified payment information remains a visible historical option; unchanged archived department names remain visible. Rejected lines are shown read-only and cannot be submitted as editable lines.
- Approve-all and reject-selected share the decision flow. Reject-selected requires at least one checked line and a reason, states that all remaining lines will be approved, and allows a separate owner approval note when accepted lines remain. Decision UUID remains stable across an unchanged retry; changed payload receives a new UUID.
- Detail separates active and rejected lines with a pale-red rejected table heading. Each rejection reason appears directly beneath its product/specification/staff note in the product cell. Rejected detail shows rows without a separate rejected totals box. One summary beneath both tables totals only accepted lines. The real PO tracker continues only for accepted lines; rejected cards keep their rejected display status.
- Rejected filtering and count are computed on the server and retain existing 10-row pagination and scope permissions. Counts may overlap actual lifecycle counts. Empty, error and loading states retain the existing list frame.
- Lock/unlock and edit-dialog cancellation refresh only the owner controls in place; preserve the detail shell, product table and page scroll. A successful save still fetches the authoritative detail.
- Edit history lists only owner_edit events, changed item names, editor, Bangkok time and delta. The before/after dialog includes only changed products, matched by stable line number, and exposes a sticky top-right × plus Escape and restored trigger focus. Legacy rejection reasons remain readable without rewriting old events.
- Rejected category reuses the normal PO card layout with only rejected names/amount, a fixed rejected badge and a fixed tracker (opened first step, later steps unfilled). Do not display the real lifecycle note on this card or advance its tracker when accepted lines receive/close. This projection never changes the real PO lifecycle.
- History highlights only changed after-values in green, including derived totals that changed, with an accessible changed indication. Before-values and unchanged after-values retain normal text. History close glyph is compact while its hit area remains usable; PO back arrows use a centered SVG. Audit date formatting remains Bangkok time without a visible “เวลาไทย” suffix.
- The history dialog uses a wider landscape layout on desktop, with before/after panels and multiple field columns inside each panel. Long notes span the panel width; narrow screens stack naturally without horizontal overflow. Other dialog widths remain unchanged.
- Excel uses the visible monthly report's latest data and separate staff/owner notes. Its third sheet contains edit history and never changes monthly totals.
