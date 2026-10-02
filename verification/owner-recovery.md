# Owner recovery — 2026-10-02

Scope: Perthyw/PO only; no production PO/profile deletion, test account creation, backup export, or actual owner password reset.

- Current Supabase password recovery documentation reviewed. Email uses normal Auth recover. Reset uses public-key Auth user API with validated recovery bearer, never administrative password mutation.
- Edge accepts alias/email only; active owner lookup and fixed allowed-origin redirect prevent caller-selected targets. Unknown/office/mail-provider failure responses are generic. Provider warnings contain no recipient or diagnostics. Timing differences and mail rate limits remain limitations.
- URL fragments are removed before async validation. Recovery bypasses regular session restore and keeps bearer only in memory. Auth verifies token; profile UUID and active owner role are checked. Minimum six characters; matching confirmation. Cancellation clears memory and attempts local logout. Success clears ordinary persisted session and attempts global logout.
- Automated suite: 75/75 passed; syntax passed. Actual app jsdom: 14 recovery cases passed; strict premium UI audit: zero findings. Mocked/isolated tests are not real browser or owner reset evidence.
- owner-account version 3 deployed ACTIVE. Read-back source matched exactly. Live checks: preflight 204, nonexistent-owner recovery 200, unsigned password mutation 401, unapproved origin 403. No recovery email sent by these tests. Frontend release checks follow the commit.
- Live email delivery, redirect allowlist/template and owner inbox/link completion are not verified. Browser observation of Supabase settings was blocked by native-credential document restrictions. No real recovery email sent by agent.

Operator check: Supabase Auth URL Configuration must allow https://po-thegrands.vercel.app/?view=recovery with correct Site URL. Recovery template should use ConfirmationURL. Default SMTP restricts recipients to organization-team addresses; configure custom SMTP if needed. Request one link, check inbox/spam, open it and enter a new password personally. Never share password/link/token in chat or GitHub.

References: https://supabase.com/docs/guides/auth/passwords ; https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/redirect-urls
