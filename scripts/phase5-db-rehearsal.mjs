// No Supabase credentials, hosted connections, or existing database resets.
// Every mutation below targets a newly created, uniquely named disposable DB.
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const run = promisify(execFile);
const container = "supabase_db_ucsa-election-system";
const database = `ucsa_phase5_rehearsal_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const backup = `/tmp/${database}.dump`;
// Retain new rehearsal databases unless cleanup was explicitly authorized.
const cleanup = process.env.UCSA_REHEARSAL_CLEANUP === "1";
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
function sql(query) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}
let created = false;
try {
  docker("exec", container, "pg_dump", "-U", "supabase_admin", "-d", "postgres", "--schema-only", "--format=custom", `--file=${backup}`);
  docker("exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "-T", "template0", database); created = true;
  docker("exec", container, "pg_restore", "-U", "supabase_admin", `--dbname=${database}`, "--exit-on-error", backup);
  // Schema-only backups deliberately omit user/account rows and storage data.
  sql("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-private','candidate-private',false,2097152,array['image/jpeg','image/png','image/webp','application/pdf']),('complaint-private','complaint-private',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);");
  let total = 0;
  for (const file of readdirSync("supabase/tests/database").filter((name) => name.endsWith(".sql"))) {
    const output = sql(readFileSync(`supabase/tests/database/${file}`, "utf8"));
    assert(!/not ok|Looks like you failed|planned .* but ran/.test(output), `${file} failed after restore`);
    const count = [...output.matchAll(/^ok \d+ -/gm)].length; assert(count > 0);
    console.log(`${file}: ${count} assertions passed after schema restore`); total += count;
  }
  // Commit only synthetic Phase 4 fixtures in this disposable database, then
  // exercise independent PostgreSQL sessions rather than mocked parallelism.
  const suite = readFileSync("supabase/tests/database/ucsa_phase4_test.sql", "utf8");
  let fixtures = suite.slice(0, suite.indexOf("set local role authenticated;"));
  fixtures = fixtures.replace(/select plan\(\d+\);/, "").replace(/^select ok\([^\n]+\n/gm, "");
  sql(`${fixtures}\ncommit;`);
  const eid = "65000000-0000-4000-8000-000000000001";
  const chair = "64000000-0000-4000-8000-000000000003";
  const prefix = `begin; set local role authenticated; set local request.jwt.claim.sub='${chair}'; set local request.jwt.claims='{"session_id":"${chair}"}';`;
  sql(`${prefix} select public.configure_election_certification_policy('${eid}',1::smallint,'Synthetic rehearsal policy',true,false); commit;`);
  async function concurrent(statement) {
    return Promise.all([0, 1].map(() => run("docker", ["exec", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-c", `${prefix} ${statement}; commit;`])));
  }
  await concurrent(`select public.reconcile_election_results('${eid}')`);
  assert.equal(sql(`select count(*)||'|'||min(revision)||'|'||max(revision) from public.election_reconciliations where election_id='${eid}';`).trim(), "2|1|2");
  const rid = sql(`select id from public.election_reconciliations where election_id='${eid}' order by revision desc limit 1;`).trim();
  sql(`${prefix} select public.record_certification_approval('${eid}','${rid}','approved','Synthetic approval'); select public.certify_election_results('${eid}','${rid}'); commit;`);
  const cid = sql(`select id from public.election_certifications where election_id='${eid}';`).trim();
  const published = await concurrent(`select public.publish_certified_election_results('${eid}','${cid}','Synthetic rehearsal')`);
  assert.equal(published[0].stdout.trim(), published[1].stdout.trim());
  assert.equal(sql(`select count(*) from public.election_publications where election_id='${eid}';`).trim(), "1");
  // Submit a separate real ballot transaction under the authenticated role,
  // then demonstrate its shared transaction ID from the owner perspective.
  const votingSuite = readFileSync("supabase/tests/database/ucsa_voting_test.sql", "utf8");
  const votingFixtures = votingSuite.slice(0, votingSuite.indexOf("-- Inject a failure")).replace(/select plan\(\d+\);/, "");
  const bindingFixture=votingSuite.slice(votingSuite.indexOf("-- New-model fixture prerequisites"),votingSuite.indexOf("end $fixture$;")+"end $fixture$;".length);
  sql(`${votingFixtures}\n${bindingFixture}\ncommit;`);
  const voter = "60000000-0000-4000-8000-000000000001";
  sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${voter}'; set local request.jwt.claims='{"session_id":"${voter}"}';
    select public.submit_election_ballot('61000000-0000-4000-8000-000000000001','[{"office_id":"62000000-0000-4000-8000-000000000001","candidate_application_id":"63000000-0000-4000-8000-000000000001"},{"office_id":"62000000-0000-4000-8000-000000000002","candidate_application_id":"63000000-0000-4000-8000-000000000002"}]'); commit;`);
  assert.equal(sql(`select count(*) from public.anonymous_ballots b join public.vote_participation p on p.election_id=b.election_id and p.office_id=b.office_id and p.xmin=b.xmin where b.election_id='61000000-0000-4000-8000-000000000001' and p.user_id='${voter}';`).trim(), "2");
  console.log(`PASS: ${total} restored assertions; 2 serialized tally requests; 2 identical publication retries / 1 row; privileged xmin correlation demonstrated.`);
  // Rehearse an actual DATA backup/restore, containing these synthetic rows only.
  const recovered = `${database}_recovered`;
  docker("exec", container, "pg_dump", "-U", "supabase_admin", "-d", database, "--format=custom", `--file=${backup}`);
  docker("exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "-T", "template0", recovered);
  try {
    docker("exec", container, "pg_restore", "-U", "supabase_admin", `--dbname=${recovered}`, "--exit-on-error", backup);
    const restored = docker("exec", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", recovered, "-c", `select count(*) from public.election_publications where election_id='${eid}';`).trim();
    assert.equal(restored, "1"); console.log("PASS: synthetic data backup and restore preserved publication records.");
  } finally {
    if (cleanup) docker("exec", container, "dropdb", "-U", "supabase_admin", recovered);
    else console.log(`Retained synthetic recovery database: ${recovered}`);
  }
} finally {
  if (created && cleanup) docker("exec", container, "dropdb", "-U", "supabase_admin", database);
  else if (created) console.log(`Retained synthetic rehearsal database: ${database}`);
  docker("exec", container, "rm", "-f", backup);
}
