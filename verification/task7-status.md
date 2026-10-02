# Task 7 — completed for PO application and permanent email/password account recovery

- [x] Application and permanent Auth users/identities captured together and encrypted with a separate recovery key.
- [x] Application rows, account credential fields and identities restored and compared with the snapshot in an isolated test project.
- [x] Target-only synthetic QA password hash backed up, changed, restored, and verified through real Auth sign-in and logout.
- [x] Imported real accounts and QA remain banned in the test project; no sessions remain.
- [x] Storage inventory has no files to back up at this capture.
- [x] Access-control/security checks and forward migration/rollback procedure verified or documented.
- [x] Weekly backup automation updated to include the reviewed account snapshot and encryption/recovery steps.

Actual users' passwords were not tried. Their restored credential fields were checked for equality with the backup. The QA login test verifies the recovery mechanism without enabling real test-project accounts.

Scope excludes live sessions, refresh/recovery/confirmation tokens, signing secrets and full platform cloning. The source account flags are preserved in the encrypted backup; real recovery activation needs review before lifting the test-only ban overrides. Dashboard MFA enrollment remains an owner-operated follow-up.

See task7-account-recovery.md and the scripts directory. Never commit backup data, credentials or recovery keys.
