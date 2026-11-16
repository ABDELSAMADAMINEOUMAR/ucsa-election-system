# Public source release verification

Verified locally on 16 November 2026. This report describes source preparation and local checks; it does not approve hosting, processing student data or real elections.

| Check | Result |
| --- | --- |
| Dependency installation | `npm ci` succeeded using the committed lockfile |
| Lint | Passed with zero warnings allowed |
| Typecheck | Next.js route generation and TypeScript passed |
| Production build | Passed without runtime credentials |
| Local secret/configuration tests | 7 passed |
| Logic, bulk validation, official-register parsers | 23 passed |
| Management HTTP boundary checks | 2 passed: ballot POST returns 503; health declares real voting disabled |
| Closed-registration checks | 2 passed: page/API closed; cross-origin protection preserved |
| Fresh application migration rehearsal | 43 migrations; 37 tables with forced RLS; 304 assertions across 9 pgTAP files passed |
| Release files and fresh Git history | Gitleaks 8.30.1: no findings |
| Exact sensitive-value comparison | No matches against 10 known historical/current credential and private signing values |
| Original repository | Working-tree status and Git refs unchanged |

The migration rehearsal used a new database with a schema-only baseline from the existing local Supabase platform, without copying application rows or resetting the source database. Transactional SQL fixtures roll back. The new synthetic rehearsal database was retained locally and is not part of the release. This was not a clean managed-provider provisioning exercise.

The complete original history (five reachable commits) was scanned before choosing fresh history. Four credential findings occurred in a historical generated Docker environment file, and a separate offline review identified signing material. The public release has one independent initial commit and no original Git objects or remote configuration. Historical privileged values differ from current local values; provider-side revocation and prior distribution have not been verified.

The release allowlist contains application source/assets, synthetic tests, required build/test/database configuration, placeholder environment configuration, ordered schema/security migrations, selected development scripts and rewritten public documentation. It excludes local environments, private keys, Supabase runtime caches, database files/dumps, real student records, private operational handovers, research folders, unrelated software, dependencies, builds, screenshots and traces. Fictional sample names/contact details are application fixtures. Bundled PDF fonts retain their license notice.

Tests demonstrate the current management and synthetic-only boundaries. They do not establish cryptographic ballot secrecy, resistance to privileged database operators, hosted security, backup integrity or readiness for a real election. Full Auth/browser/concurrency/recovery suites were included but were not rerun against a newly provisioned Supabase platform during this release preparation. Dependency vulnerability scanning was not performed in this run.

Private detailed scan results, command logs and a hash manifest are retained outside the release directory for owner review. Automated scans and focused manual inspection reduce disclosure risk but cannot prove the absence of every possible secret or personal datum. No push, publication or deployment was performed. Publishing requires the owner's separate approval.
