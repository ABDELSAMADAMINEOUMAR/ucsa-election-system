# Security and privacy boundaries

Real elections and real electronic voting are not approved for this application.

The ballot API rejects submission with HTTP 503 unless both demo mode and the explicit synthetic-voting opt-in are configured. Database migration `202611160001_synthetic_ballot_boundary.sql` independently rejects official and unclassified elections. Authenticated callers cannot execute the legacy submission function directly. The shipped environment template closes voting and public registration. Synthetic classification is a rehearsal restriction; a privileged operator can change database code or misclassify data, so it is not a defense against an administrator introducing real records.

Ballots are stored in plaintext. Privileged operators can correlate identity and selections through transaction metadata and can tamper with a database they administer. Do not claim anonymous or independently verifiable elections. Independent architecture review, election policy approval, stronger operational controls, backup/restore exercises, distributed abuse protection and appropriate account security remain prerequisites for any real use. In-process rate limiting does not provide distributed protection.

Never commit runtime environment files, API secrets, JWT signing material, private keys, student rosters, registration lists, evidence uploads, database snapshots, logs or browser traces. Browser publishable keys and server API secrets have different trust boundaries. Keep service credentials server-only; never use a `NEXT_PUBLIC_` prefix for secrets.

An earlier private repository history contains credential findings. This public release deliberately starts a new history and does not copy Git objects, remotes, reflogs or local environment files. Fresh history prevents those objects from being included here; it does not revoke exposed credentials or remove existing copies elsewhere. The owner must verify revocation and any previous distribution privately.

Report vulnerabilities privately to the repository owner through an available private reporting channel. Do not put credentials, exploit data or student information in public issues. This preparation does not configure a security contact or send a report.
