import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const script = resolve("scripts/init-local-secrets.mjs");
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "ucsa-local-secrets-test-"));
  mkdirSync(join(root, "supabase"));
  try { run(root); } finally {
    const target = resolve(root);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("ucsa-local-secrets-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}
const invoke = (root, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
test("fresh bootstrap creates private signing operations and prints no generated credentials", () => fixture((root) => {
  writeFileSync(join(root, ".env.local"), "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55021\nSUPABASE_LOCAL_SECRET_KEY=previous-local-secret-value\nSUPABASE_LOCAL_SECRET_KEY=previous-local-secret-value\n");
  const result = invoke(root); assert.equal(result.status, 0);
  const keys = JSON.parse(readFileSync(join(root, "supabase/local-signing-keys.json"), "utf8"));
  assert.deepEqual(keys[0].key_ops, ["sign", "verify"]); assert.equal(keys[0].alg, "ES256");
  assert.ok(!result.stdout.includes(keys[0].d)); assert.ok(!result.stderr.includes(keys[0].d));
  const environment = readFileSync(join(root, ".env.local"), "utf8");
  assert.ok(!environment.includes("previous-local-secret-value"));
  for (const line of environment.split("\n").filter((value) => /^(SUPABASE_LOCAL_.*|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_TEST_SECRET_KEY|SUPABASE_TEST_JWT_SECRET)=/.test(value))) {
    const value = line.slice(line.indexOf("=") + 1); assert.ok(!result.stdout.includes(value));
  }
}));
test("repeat bootstrap preserves matching local credentials", () => fixture((root) => {
  assert.equal(invoke(root).status, 0); const env = join(root, ".env.local"); const keys = join(root, "supabase/local-signing-keys.json");
  const before = [digest(env), digest(keys)]; assert.equal(invoke(root).status, 0); assert.deepEqual([digest(env), digest(keys)], before);
}));
test("existing signing material and a replaced environment fail without changing files", () => fixture((root) => {
  assert.equal(invoke(root).status, 0); const env = join(root, ".env.local"); const keys = join(root, "supabase/local-signing-keys.json");
  writeFileSync(env, "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55021\n"); const before = [digest(env), digest(keys)];
  assert.notEqual(invoke(root).status, 0); assert.deepEqual([digest(env), digest(keys)], before);
}));
test("hosted configuration is rejected without creating signing material", () => fixture((root) => {
  const env = join(root, ".env.local"); writeFileSync(env, "NEXT_PUBLIC_SUPABASE_URL=https://unconfigured.example.invalid\n"); const before = digest(env);
  assert.notEqual(invoke(root, "--rotate").status, 0); assert.equal(digest(env), before); assert.equal(existsSync(join(root, "supabase/local-signing-keys.json")), false);
}));
