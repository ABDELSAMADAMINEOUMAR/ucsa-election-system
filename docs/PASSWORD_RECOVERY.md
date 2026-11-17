# Password recovery

The recovery request URL is https://ucsa-election-system.vercel.app/account/reset-password. This URL was already correct; it has not moved. The secure sign-in page's **Forgot password?** link points there.

Enter the existing account email, request a new message, and open the newest link in the same browser/profile used to request it. Supabase PKCE requires that browser's verifier cookie. Choose a password of at least 12 characters containing a letter and a number, then sign in again. Never share the email link, password, or browser cookies.

## Routes and production configuration

| Purpose | Route |
| --- | --- |
| Request a reset email | `/account/reset-password` |
| Receive and exchange a new recovery email's PKCE code | `/account/recovery` |
| Choose the new password after authentication | `/account/reset-password/new` |
| Legacy PKCE email callback | `/account/callback?next=%2Faccount%2Freset-password%2Fnew` |
| Student register activation, unrelated to password recovery | `/account/activate` |

Production Site URL is `https://ucsa-election-system.vercel.app`. The Supabase redirect allowlist contains the exact production `/account/callback` and `/account/recovery` URLs. No localhost or preview wildcard is enabled. New recovery emails use the dedicated fixed callback; it cannot accept a registration destination. The legacy callback remains supported for already-sent messages and has an explicit destination allowlist.

The configured production recovery email template uses Supabase's `.ConfirmationURL`, rather than directing the user straight to registration or the Site URL. Public signup remains disabled, email confirmation remains required, and recovery does not create committee memberships or grant student eligibility.

## Diagnosis and fix, 17 November 2026

Direct requests and browser navigation from **Forgot password?** reproduced the correct recovery request page in production. There was no missing request page or middleware redirect to registration.

The confirmed failure path was a failed recovery code exchange: it redirected to generic sign-in with an unrendered `notice=link-invalid`. That screen advertised student registration despite signup being closed. The recovery form also displayed student-register requirements, a register-correction help link, and a demo-entry link. These messages and the silent error fallback made recovery look like registration. The exact reason the owner's original link failed cannot be determined without that browser's state; no private link or credentials were requested.

The fix separates recovery callbacks from activation, explains invalid/expired/reused/different-browser links on the recovery form, requires an authenticated session before showing the new-password form, and removes registration prompts from recovery. Closed-registration sign-in hides the student-signup link. Callback redirects use the configured canonical origin so an internal hostname cannot lose the newly issued session cookie. Account pages and callbacks use `Referrer-Policy: no-referrer`; callbacks and reset responses are not cached. Provider failures receive a generic error instead of a false success message. Provider errors, codes, tokens, and cookies are never logged by these handlers.

## Verification

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed with production-mode rendering against the local synthetic Auth configuration. Vercel must build again with its production environment; do not deploy this local build with `--prebuilt`.
- `playwright.recovery.config.ts`: **11 passed**. Tests cover canonical URLs, rejected callback destinations, closed registration, navigation, missing sessions, invalid callbacks, cross-origin protection, a real synthetic email/PKCE/password change, old-password rejection, replay rejection, and a different-browser failure without a password change.
- Synthetic Auth accounts existed only on local Supabase and were deleted by the tests. No committee roles were assigned. Production accounts, passwords, committee permissions, student records, and election records were not changed.

Run the recovery suite only with the local Supabase URL `http://127.0.0.1:55021`, local public/server/test keys, and Mailpit on port 55024. The suite refuses production, keeps registration closed on its app server at port 3114, and disables Playwright traces/screenshots/video to keep recovery credentials out of artifacts. The local build and runtime must use the same local Auth configuration. Production mailbox completion remains an account-holder action.
