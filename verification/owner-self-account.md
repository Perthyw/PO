# Owner self-account verification

Owner-only account settings added with current-password confirmation, original email retention, alias signin and self password updates. No target-ID/email/role mutation accepted.

- Repository test suite: 58/58 passed, including 23 Edge handler security regression tests; npm run check passed.
- Isolated jsdom harness using actual app.js: route/menu, password masking, validation, failure retention, alias normalization, password clearing, confirmation mismatch, return to signin, and no persisted password passed. This is DOM verification, not a real browser password change.
- Strict premium UI audit: zero findings.
- Production owner-account Edge function ACTIVE v1; downloaded source matches deployed source. Live preflight204, unsigned mutation401, disallowed origin403, unknown-alias invalid-password400 verified.
- Real owner alias set after caller-approved administrative check; original email, UUID, role and password hash equality verified without exposing credentials.
- Live browser observation was blocked for documents containing native credentials. Real owner password was not entered or changed by the agent. Owner must verify the signed-in UI and personally submit the desired new password.

Scope remains PO only. No new production test accounts or POs were created for this feature. Passwords, private account details and recovery keys are excluded from git.
