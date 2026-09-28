# PO The Grands business contract

Source: explicit user request and browser comments dated 2026-09-25. This is an independent PO application. There is no Supabase project yet.

Office creates a PO. Owner approves or rejects it; rejection requires a reason. Office confirms all goods received. Owner can close only after receiving the tax invoice. The same close gate applies to VAT and NON VAT purchases.

Each PO stores a selectable PO date defaulting to today, system submission time, product name, specification, source/vendor, quantity, a required free-text unit such as กล่อง แพ็ก ชิ้น or กิโลกรัม, VAT-inclusive unit price, VAT flag, item note, calculated base/VAT/total, requester, status, and immutable event history. The unit appears in review, detail, and exported item rows. The review screen precedes submission.

For VAT items, the entered price is the final VAT-inclusive price. VAT is `gross × 7 / 107`; base is `gross − VAT`. Calculations round half-up to satang for each line. NON VAT uses the full gross amount as base with zero VAT. The database recalculates authoritative totals.

Monthly reports count PO value only after approval (`approved`, `received`, `closed`) and export summary and item worksheets to `.xlsx`. The item sheet includes PO status and department/branch. Pending and rejected counts remain visible but their value is excluded from the ordered total.

Owner credentials and office credentials are required. The owner creates, edits, resets, or disables office accounts and grants the combined-report capability to the designated primary purchasing account. Office login uses a unique account name such as `purchase.fai01`, while the visible staff name may be Thai such as `น้องฝ้าย`. Office passwords may use letters or numbers and contain at least six characters. Public signup, attachments, payments, inventory, partial receipt, and purchase dispatch are outside scope.
