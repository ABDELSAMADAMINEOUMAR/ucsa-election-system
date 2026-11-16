import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentEnvironmentErrors } from "./verify-deployment-env.mjs";

const fictional = { NEXT_PUBLIC_SUPABASE_URL: "https://fictionalproject.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fictional" };
test("accepts managed production environment shapes without contacting services", () => assert.deepEqual(deploymentEnvironmentErrors(fictional), []));
test("rejects missing configuration and loopback/development origins", () => {
  assert.equal(deploymentEnvironmentErrors({}).length, 3);
  for (const origin of ["http://127.0.0.1:55021", "https://localhost", "https://fictionalproject.supabase.co/path", "https://user:pass@fictionalproject.supabase.co"]) assert.ok(deploymentEnvironmentErrors({ ...fictional, NEXT_PUBLIC_SUPABASE_URL: origin }).length);
});
test("rejects test credentials, public secrets and placeholders without revealing values", () => {
  const errors = deploymentEnvironmentErrors({ ...fictional, SUPABASE_TEST_SECRET_KEY: "sensitive-test-value", NEXT_PUBLIC_PRIVATE_KEY: "sensitive-private-value", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_replace_me" });
  assert.equal(errors.length, 3);
  assert.ok(!errors.join().includes("sensitive-"));
});
