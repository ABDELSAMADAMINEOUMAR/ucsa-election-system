# Configuration, migrations and tests

## Configuration

`.env.example` contains placeholders. `npm run local:secrets` generates project-specific local credentials in ignored files. It does not contact a hosted provider. The Supabase CLI reads local JWT/API keys through environment references in `supabase/config.toml` and a generated private signing-key file. Preserve matching key/environment files for retained stacks; intentional rotation requires restarting only the intended stack and replacing sessions. Never copy a development key into production.

Defaults are management mode, synthetic voting disabled, and public registration disabled. `scripts/verify-deployment-env.mjs` checks hosted URL/key shapes without contacting a provider. It does not certify deployment readiness, project ownership, revocation or provider security settings. A managed deployment needs a separate review and authorization.

## Safe schema changes

The migration directory contains the application's complete ordered SQL chain. It includes tables, RLS policies, functions, grants and private Storage bucket definitions, with security corrections in subsequent migrations. Apply the complete chain before exposing the API. No roster exports, Auth users, ballot dumps, private credentials or seed data are included. Data-changing statements inside trusted functions implement application operations; migrations also contain targeted schema/data upgrades and must be reviewed against the destination state.

For a brand-new disposable local stack, `npm run db:start` provisions the platform and applies migrations. For a retained database, first back up and verify recovery, then review pending SQL and use the appropriate forward-only migration process. `npx supabase migration up --local` applies pending local migrations. This release preparation never resets the original database. `npm run db:reset` is destructive and is for disposable development databases only. Never use it on retained data. No hosted migration has been performed by this preparation.

`node scripts/verify-fresh-migrations.mjs` creates a uniquely named local database using a schema-only platform baseline from container `supabase_db_ucsa-election-system`, applies all application migrations and runs all transactional pgTAP files. It does not copy application rows or reset the source. It retains the newly created rehearsal database; it is not exported with this repository. This requires a running compatible local platform. Adjust the container deliberately for an independent stack. It is not a substitute for provisioning and testing a clean hosted platform.

`npm run test:recovery` uses that same named local container for synthetic backup/recovery rehearsals in new databases. Read the script before running. Neither rehearsal proves recovery of real Storage object bytes or a managed provider environment.

## Tests

Logic and environment-generator tests need no real student data. Browser tests require a build and an installed supported browser. Integration suites use only local API port 55021 and fictional identities, with keys obtained privately from the disposable stack. Do not run them on an existing retained database: some fixtures exercise administrative operations and append-only evidence remains after tests. A test fixture is not an account bootstrap procedure for production.

Database suites run inside rollback transactions and check RLS, role/session boundaries, registration, nominations, bulk operations, official-register rules and voting restrictions. The delivery-boundary suite rejects official ballot submission and verifies that the authenticated role cannot execute the legacy voting RPC. Application logic tests check that management/production/real modes cannot enable synthetic voting.

Generated reports, screenshots, traces, dependency directories and build caches are ignored. They are local verification artifacts and must stay out of commits. Review `git status` and scan the full proposed Git history before any public push. Never add original repository objects or merge its history into this release.
