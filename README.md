# UCSA Election Management System

A Next.js, React, TypeScript and Supabase application for the UNILAK Chadian Students Association's election administration workflows. Includes fictional demo screens, authenticated committee and student workspaces, official-register import and approval, candidate applications, eligibility, complaints and PDF reporting.

**Real electronic voting remains disabled.** This source release is for review, development and fictional rehearsals. It is not an authorization to collect student data, deploy a production service or conduct an election. Privileged database operators can correlate plaintext ballot selections; cryptographic anonymity and end-to-end verifiability are not provided. See [SECURITY.md](SECURITY.md).

## Local setup

Use Node.js 20.9 or newer and npm. Install dependencies using the lockfile:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The `/student` and `/committee` experiences use fictional browser demo data. Authenticated `/account` routes require Supabase. Names, contact details and identifiers in demo and test fixtures are synthetic; never replace them with actual student records in source control.

For an isolated local backend, Docker Desktop and the Supabase CLI (included as a development dependency) are required. Copy `.env.example` to `.env.local`, then run `npm run local:secrets`. This generates ignored local credentials and a private signing key without printing them. Do not commit the generated files. Start the stack with `npm run db:start`. API, database, Studio and captured test mail use ports 55021, 55022, 55023 and 55024. No hosted configuration is included.

The default local project identifier is `ucsa-election-system`. Check for an existing stack before starting: do not attach a public-source checkout to a retained database. Use a separate machine or change the project identifier and ports for an independent development stack. Scripts that name the original local container also need adjustment before use against that separate stack.

Keep `UCSA_DEPLOYMENT_MODE=management`, `UCSA_SYNTHETIC_VOTING_ENABLED=false` and `UCSA_PUBLIC_REGISTRATION_ENABLED=false`. Configure public Supabase URL/publishable key and server-only API key through ignored environment files or a hosting secret store. No production keys are provided. [Configuration and migrations](docs/DEVELOPMENT.md) explains the boundaries.

## Validation

```sh
npm run lint
npm run typecheck
npm run build
npm run test:local-secrets
node --test scripts/verify-deployment-env.test.mjs
npm run test:logic
npx playwright test tests/bulk.logic.spec.ts tests/official-register.logic.spec.ts
npx playwright test --config playwright.management.config.ts
npx playwright test --config playwright.registration-closed.config.ts
```

Build before browser tests. The default browser channel is installed Microsoft Edge; set `PLAYWRIGHT_CHANNEL=chrome` for installed Chrome. Logic tests run through Playwright, whose base configuration starts the production server on port 3100. The management and closed-registration tests verify that ballot POST requests return HTTP 503 and public registration is closed without needing database credentials.

`npm test` includes integration suites requiring the disposable local Supabase stack and fictional test credentials. Do not point them at hosted or retained data. `npm run test:db` runs transactional pgTAP tests. See [testing and migration guidance](docs/DEVELOPMENT.md) before running database or recovery scripts.

## Repository contents

- `src/`: application, API routes, validation, demo fixtures and bundled PDF fonts.
- `public/`: public assets, including the association logo.
- `supabase/migrations/`: ordered application schema and security migrations; no database dumps or student roster seeds.
- `supabase/tests/` and `tests/`: synthetic database, logic, integration and browser tests.
- `scripts/`: local secret generation, environment checks and isolated database rehearsals.
- `.env.example`: placeholder configuration only.

This release uses fresh Git history. The original working repository and its historical credential material are excluded. Historical credentials require owner-side revocation verification; this release does not establish that revocation occurred. No deployment or publishing workflow is configured. No open-source license is granted by this preparation; confirm ownership and choose a license before inviting reuse. Bundled Noto fonts retain their SIL Open Font License in `src/lib/reports/fonts/OFL.txt`.
