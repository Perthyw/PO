# PO The Grands business contract

Source: explicit user request and browser comments dated 2026-09-25 onward. This is an independent PO application. A Supabase project has been created, but the website has not yet completed schema deployment, configuration, data migration, or production verification.

Office creates a PO. Owner approves or rejects it; rejection requires a reason. Office confirms all goods received. Owner can close only after receiving the tax invoice. The same close gate applies to VAT and NON VAT purchases.

Each PO stores a selectable PO date defaulting to today, system submission time, product name, specification, source/vendor, quantity, a required free-text unit such as กล่อง แพ็ก ชิ้น or กิโลกรัม, VAT-inclusive unit price, VAT flag, item note, calculated base/VAT/total, requester, status, and immutable event history. The unit appears in review, detail, and exported item rows. The review screen precedes submission.

For VAT items, the entered price is the final VAT-inclusive price. VAT is `gross × 7 / 107`; base is `gross − VAT`. Calculations round half-up to satang for each line. NON VAT uses the full gross amount as its item base with zero VAT. In the PO summary, “รวมก่อน VAT” includes only VAT-item bases; NON VAT remains in the grand total. The database recalculates authoritative stored totals.

Monthly reports count PO value only after approval (`approved`, `received`, `closed`) and export summary and item worksheets to `.xlsx`. The item sheet includes PO status and department/branch. Pending and rejected counts remain visible but their value is excluded from the ordered total.

Owner credentials and office credentials are required. The owner creates, edits, resets, or disables office accounts and grants the combined-report capability to the designated primary purchasing account. Office login uses a unique account name such as `ชื่อบัญชีที่เจ้าของกำหนด`, while the visible staff name may be Thai such as `น้องฝ้าย`. Office passwords may use letters or numbers and contain at least six characters. Public signup, attachments, payments, inventory, partial receipt, and purchase dispatch are outside scope.

## Owner self-account settings

The owner may change their own login alias and password after verifying their current password. The original Auth email, UUID and owner role remain unchanged. Login aliases are lowercase, unique and case-insensitive at entry. Alias signin authenticates the password server-side without publishing an alias-to-email resolver. Password updates require at least six characters and confirmation; successful password change returns the user to login. Office users cannot change owner credentials through this endpoint.


## Owner password recovery

Owner recovery accepts alias/email, keeps tokens in memory only, and returns to login after setting a matching password of at least six characters. Office users contact the owner. Live email/redirect verification remains required.


## Per-item payment information
New PO items require an explicit `credit` or `cash` selection in the creation UI, with no default. This is informational metadata for the owner, not payment processing or settlement tracking. Review/detail tables and monthly Excel item rows show the Thai labels เครดิต/เงินสด under การชำระเงิน. Historical items and backward-compatible callers without this field remain unspecified; no historical values are inferred. Totals, VAT and lifecycle rules are unchanged.

## Owner edits and item decisions — approved scope, 9 October 2026

The current user decisions supersede the earlier immutable-item rule. Only an active owner can unlock and edit a PO in pending, approved or received state. Closed and rejected POs, and individually rejected lines, are immutable. An edit preserves PO UUID, number, requester, date, real lifecycle status and stable line numbers; it cannot add, remove or reorder lines. Editable fields are department, name, specification, source, quantity, unit, VAT-inclusive unit price, VAT flag, payment information and staff item note. Unchanged historical archived departments and unspecified payment information remain valid; missing historical information is never inferred.

An owner can reject multiple selected lines of a pending PO with a required reason. Every unselected line is approved in the same PO. Rejecting every line makes the real PO status rejected; otherwise it becomes approved and continues through receipt and invoice closure. Rejected rows are retained permanently with their reason and decision actor/time, but excluded from active totals, VAT, purchased value and the current-item Excel sheet.

The rejection category counts distinct visible POs containing rejected lines, including partially rejected POs that are later received or closed. Its cards show only rejected names, totals and a fixed rejected display status. This is a projection and never changes the underlying PO lifecycle. Status-category counts can overlap and must not be summed to infer a total document count.

Owner approval notes are independent of staff item notes and rejection reasons. Edits append immutable before/after snapshots, editor, server time, changed item names and monetary deltas. Approval, rejection, receipt and closure remain lifecycle history and are never labelled item edits. Saving identical values creates no new edit event, notification or version. Retry of a committed command returns its cached result; stale versions cannot overwrite newer data.

Excel contains monthly summary, current non-rejected product rows, and a separate edit-history sheet. Current rows reflect all latest edited fields. History includes original and changed values, item amount deltas and the PO delta only once per edit; audit amounts never contribute to purchased totals. The existing primary-office reporting permission remains unchanged.

No existing PO, line, event, notification or command is deleted or reset. All 38 documents in the pre-change snapshot, every lifecycle status, and subsequently created documents are retained. Trial-browser data is not reset or imported automatically. HR is outside scope. Production database changes, commit and web deployment await user acceptance of the development result.
