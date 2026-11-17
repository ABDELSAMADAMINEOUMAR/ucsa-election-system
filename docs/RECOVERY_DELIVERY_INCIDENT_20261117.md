# Production recovery delivery incident — 17 November 2026

## Confirmed root cause

Supabase Auth rejected a recovery email with HTTP **429**, code **`over_email_send_rate_limit`**, error **`429: email rate limit exceeded`**. The project uses the default Supabase email sender with **2 emails/hour**, not custom production SMTP. `smtp_host` and `smtp_port` are unset, no SMTP username/sender is configured, and no send-email hook is enabled. Local Mailpit has no role in production delivery.

Sanitized production evidence, UTC:

| Time | Evidence |
| --- | --- |
| 07:19:38 | Auth recorded `mail.send`, type `recovery`, to the affected existing account; `/recover` returned 200. |
| 08:01:18 | Auth recorded another `mail.send`, type `recovery`, to the same account; `/recover` returned 200. |
| 08:05:48 | `/recover` returned 429, `over_email_send_rate_limit`; Supabase request ID `01a1e88a-6c28-7745-a3a7-821ab789c1e2`. |
| 08:09:49 | One authorized diagnostic request reproduced 429 and the same code; Supabase request ID `01a1e88e-19af-7b12-801c-437f18d6932b`. |

Vercel recorded `wafAction=allow` for the failure. The application returned `{"error":"Password recovery is temporarily unavailable. Please try again later."}` with HTTP 429. The separately reported wording “This action is not available now” is not a string in the deployed source; the actual response and provider code above establish the failure independently of UI wording.

The application's per-address recovery counter was 3 of 8 in the 08:00 UTC hour; the shared counter was 3 of 5000. Neither application limit was exhausted. The request reached the correct hosted Supabase project, which rules out a frontend-only failure, missing environment variables, an incorrect project URL, or Vercel firewall blocking for this incident.

## Configuration and boundaries

Production has all seven expected Supabase/site/deployment environment variables. Their values were not printed. Runtime calls and provider log correlation verify use of the linked project. The configured Site URL and the exact `/account/callback` and `/account/recovery` redirect allowlist are correct. The recovery template uses `.ConfirmationURL`.

Public signup remains disabled and email confirmation remains required. No password, committee role, RLS policy, election record, SMTP setting, or provider rate limit was changed. No production test account was created. One diagnostic request was made for the affected account; it was throttled and sent no new email. No retry loop or additional live recovery email was used for diagnosis.

## Application correction

Delivery success, an unknown email, and delivery failure now receive the same HTTP 200 conditional acknowledgement, which explicitly warns that delivery may be temporarily limited and discourages repeated requests. This prevents a provider failure for a registered account from becoming an account-enumeration signal. The acknowledgement does **not** certify email submission or delivery.

Server diagnostics record only an allowlisted provider error code, numeric status, source, and event name. They never include the address, provider message, password, token, cookies, or recovery URL. Application validation, same-origin protection, public-action rate limits, PKCE, and callback/session checks remain enforced. Recovery makes exactly one provider request, with no automatic retry.

The application correction does **not** change the SMTP quota or restore throttled delivery by itself.

## Required operational action

For reliable delivery to real users, open:

https://supabase.com/dashboard/project/dqqoljefardprughkyzb/auth/smtp

Configure a real SMTP provider using its host, port, username, SMTP password, verified sender email, and sender name. Verify the sender/domain with the provider's required DNS records and remove any provider sandbox recipient restrictions. Enter the credentials directly in Supabase, never in chat or the repository. Configure an appropriate email limit under Authentication → Rate Limits within the provider's allowance. Retain required email confirmation, disabled signup, and the current HTTPS redirect destinations.

See [Supabase's SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp): its default sender is limited to project-team recipients and 2 messages/hour and is not intended for production use. No external provider credentials were supplied, so custom SMTP was not configured or claimed operational.

For the existing account only, a conservative fallback is to leave at least 60 minutes without further recovery requests after the last attempt. The diagnostic attempt was at **08:09:49 UTC / 10:09:49 Africa/Kigali**. If there are no later requests, make **one** browser-initiated attempt after **09:10 UTC / 11:10 Africa/Kigali**, using `/account/reset-password`. Open only the newest email in the same browser/profile. Do not reuse a consumed link. If no message arrives, stop requesting and complete SMTP setup or review the sanitized provider logs. This time is a conservative retry instruction, not a verified quota-reset guarantee.

After SMTP configuration, verify one accepted send in Auth/provider logs and actual receipt in the intended mailbox before declaring delivery restored. An HTTP 200 acknowledgement alone is insufficient.

## Validation before release

`npm run lint`, `npm run typecheck`, and `npm run build` passed. The recovery/registration suite passed **14 tests**, including the full local synthetic Mailpit → PKCE → new-password → sign-in flow, replay rejection, missing-browser protection, registration closure, delivery-failure acknowledgement equality, no automatic provider retries, and sanitized diagnostics. These tests did not consume production email quota. Synthetic local users were cleaned up without committee grants. Production verification must use a nonexistent synthetic address for the post-deployment endpoint smoke check; the account holder's next real request is reserved for the cooldown/provider-configuration instructions above.
