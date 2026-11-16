// Rehearse every application migration against a NEW local database containing
// Supabase platform schemas only. Never reset or delete any database.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const container = "supabase_db_ucsa-election-system";
const database = `ucsa_fresh_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const dump = `/tmp/${database}.dump`;
const list = `/tmp/${database}.list`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
function sql(input) {
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}
let created = false;
try {
  // Schema-only platform baseline: no Auth users, objects, buckets, app tables
  // or application migration history. App-owned Auth triggers and Storage
  // policies are recreated by migrations, not copied from the installed app.
  docker("exec", container, "pg_dump", "-U", "supabase_admin", "-d", "postgres", "--schema-only", "--format=custom", "--exclude-schema=public", "--exclude-schema=supabase_migrations", `--file=${dump}`);
  const toc = docker("exec", container, "pg_restore", "--list", dump).split("\n").filter(line => !/\bTRIGGER auth users on_auth_user_(created|email_updated)\b|\bPOLICY storage objects\b/.test(line)).join("\n");
  execFileSync("docker", ["exec", "-i", container, "tee", list], { input: toc, stdio: ["pipe", "ignore", "pipe"] });
  docker("exec", container, "createdb", "-U", "supabase_admin", "-O", "postgres", "-T", "template0", database);
  created = true;
  docker("exec", container, "pg_restore", "-U", "supabase_admin", `--dbname=${database}`, "--exit-on-error", `--use-list=${list}`, dump);
  assert.equal(sql("select count(*) from pg_tables where schemaname='public';").trim(), "0");
  const migrations = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
  for (const name of migrations) sql(readFileSync(`supabase/migrations/${name}`, "utf8"));
  assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity;").trim(), "37");
  let assertions = 0;
  for (const name of readdirSync("supabase/tests/database").filter(name => name.endsWith(".sql")).sort()) {
    const output = sql(readFileSync(`supabase/tests/database/${name}`, "utf8"));
    assert(!/not ok|Looks like you failed|planned .* but ran/.test(output), `${name} failed on fresh migrations`);
    const count = [...output.matchAll(/^ok \d+ -/gm)].length;
    assert(count > 0); assertions += count;
    console.log(`${name}: ${count} assertions passed on fresh migrations`);
  }
  console.log(`PASS: ${migrations.length} migrations applied from no application tables; ${assertions} assertions; 37 forced-RLS tables.`);
  console.log("Boundary: platform schema baseline was copied from local Supabase; this is not hosted platform provisioning or an object-byte restore.");
} finally {
  if (created) console.log(`Retained new fictional migration database: ${database}`);
  // Remove only the two generated schema/list files, never a database.
  docker("exec", container, "rm", "-f", dump, list);
}
