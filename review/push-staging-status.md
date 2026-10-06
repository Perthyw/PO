# Push staging — 6 October 2026

- Production Vercel and Supabase rhkilsnuqdkzwlncjvkj were not deployed or modified.
- Existing owner-private PO Site: https://po-desk-office.grandsfoods.chatgpt.site/ . Published commit fbdadb84193f3026f4cc4cd46abe653d6ce804d6; deployment appgdep_6ac4a748fba48191a8104c8bd7851531 succeeded.
- Uses the existing isolated test project tctartzpqrbxhkcgwmmu; no plan change or new project. Original restored accounts remain untouched; created two distinct Push QA accounts and verified real Auth signin for both.
- Push schema, RLS and service-only queue/secret RPC ACL verified on staging. Dedicated secrets are in staging Vault, never in this repository. Worker verifies scheduler secret; unauthorized HTTP 401, authorized HTTP 200. Bundling web-push 3.6.7 succeeded on hosted Edge despite the local registry failure.
- Cron dispatch every minute returned HTTP 200 repeatedly. Temporary QA bootstrap was replaced with a 410 handler after setup.
- Website labels the environment as a Push test site. Existing private audience preserved. Cloud browser reached its ChatGPT signin gate; authenticated website UI and device notification delivery are not claimed as tested.
- User must open this test URL from Safari, add it to Home Screen, sign in with the private QA credentials and explicitly enable notifications. The old production Home Screen icon is a different origin.
- Pending: real iOS/Android/desktop subscription + delivery + tap-through; hosted worker send with a genuine endpoint; Edge runtime behavior under provider failures. No production approval is inferred.
- Implementation patch in review/web-push-20261006.patch applies to main 5d5eb44f8b1ea9658f58096b8ad0fa201ad7eeab. This review branch does not replace runtime source on main.
