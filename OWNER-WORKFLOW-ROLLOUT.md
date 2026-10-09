# Owner edits and partial rejection — development acceptance

## Scope

Owner-only unlock/edit before closure; partial item rejection on a pending PO; permanent rejection display; separate owner approval notes; current Excel data plus edit history. Preserve every existing document and event. No HR, no trial reset, no automatic trial import, no production writes or deployment during development acceptance.

## Data preservation

The 9 October 2026 encrypted snapshot contains 38 POs, 56 item rows, 110 events, 110 notifications, 110 command records, 28 departments and 3 profiles. Permanent Auth backup contains 4 users and 4 identities. Credentials are not committed to this repository.

Development preservation verification restores application rows into a fresh in-memory PGlite database with placeholder Auth UUIDs, applies the forward migration, and compares every original column in all seven tables. This proves application row, sequence and old-report preservation for that snapshot; it is not a production restore or a full Auth restore. Fresh backup and the latest count/fingerprint check remain required immediately before any future production migration.

Unlock leases are transient security state. Do not back up or restore live lease tokens. Persistent decision and audit data remain in purchase_orders, po_items and po_events, already covered by the existing backup scripts. After recovery, edit UI starts locked.

## Acceptance cases

1. Owner unlocks and edits name, quantity, price, source, specification, unit, department, VAT, payment information and note; PO number and real status remain unchanged.
2. Owner edits pending/approved/received; closed, rejected and rejected lines cannot be edited through either UI or RPC. Office and anonymous calls are rejected by the server.
3. Select several rejected lines with a reason; all other lines are approved in the original PO. Active amount and VAT exclude rejected rows. All-selected rejection ends the entire PO without deleting any line.
4. Rejected filter shows its own names/amount/status after the accepted part is received or closed. The same PO may appear in its current lifecycle category and rejected category.
5. Approval notes remain separate from staff notes. Edit history shows only edits, before/after and delta; no-op saves create no false audit.
6. Excel opens correctly with current product values and a separate edit-history sheet. Rejected products are excluded from current totals. Audit values do not add to the purchase total.
7. Two sessions try to edit/decide/receive/close the same version; only the valid winner commits. An unchanged retry after timeout returns the same result and does not duplicate events or notifications.
8. Existing archived departments, missing payment information, rejection reasons, old command results and historical PO documents remain intact. Browser trial localStorage is not reset.

## Before production

Development verification on 9 October 2026 passed 98 automated tests, a real Edge demo workflow and Excel workbook readback. The encrypted 38-PO snapshot preserved all original columns in seven tables. Supabase TEST RPC assertions passed in a rolled-back transaction; nine test-table fingerprints remained unchanged. See VERIFICATION.md for evidence and limitations. Separate staging acceptance passed real Auth/REST contention, role checks, Edge workflow and Excel readback. Notifications deferred by the user. See latest VERIFICATION.md evidence.

- User reviews and accepts the development result before commit and deployment.
- Verify current source/target project identities. Production is rhkilsnuqdkzwlncjvkj; development tests must never write to it.
- Verify fresh encrypted backup, separate recovery key, decryption integrity, current row counts and a restore into an isolated database.
- Review the new migration, privileges and schema compatibility. Inspect migration plan/dry-run before applying.
- Database integration in a separate Supabase project and browser/Excel acceptance must be documented independently of mock/PGlite results.
- Apply only the reviewed additive production migration when authorized, then verify original-data fingerprints/counts before publishing the matching frontend.

## Rollback

Keep the prior web release and encrypted pre-change snapshot. Returning the web release alone does not undo database decisions or edits. Do not restore the old snapshot over a live database, drop tables/columns, delete events or reset documents.

If a release fails, pause the affected actions and deploy a forward correction preserving current data, line decisions and audit history. Older act_on_po clients must not bypass item decisions or include rejected amounts. Restore, if needed after an actual incident, is first validated in an isolated project with explicit source/target and account-state review. New unlock leases are never restored from backup.

