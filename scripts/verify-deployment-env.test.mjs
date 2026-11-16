import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentEnvironmentErrors } from "./verify-deployment-env.mjs";

const fictional = { NEXT_PUBLIC_SUPABASE_URL: "https://fictionalproject.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fictional", UCSA_SITE_URL: "https://elections.example.org", UCSA_DEPLOYMENT_MODE: "management", UCSA_SYNTHETIC_VOTING_ENABLED: "false", UCSA_PUBLIC_REGISTRATION_ENABLED: "false" };
test("accepts managed production environment shapes without contacting services", () => assert.deepEqual(deploymentEnvironmentErrors(fictional), []));
test("rejects missing configuration and loopback/development origins", () => {
  assert.equal(deploymentEnvironmentErrors({}).length, 7);
  for (const origin of ["http://127.0.0.1:55021", "https://localhost", "https://fictionalproject.supabase.co/path", "https://user:pass@fictionalproject.supabase.co"]) assert.ok(deploymentEnvironmentErrors({ ...fictional, NEXT_PUBLIC_SUPABASE_URL: origin }).length);
});
test("rejects rehearsal/registration enablement and invalid application origins", () => {
  for (const changes of [{ UCSA_DEPLOYMENT_MODE: "demo" }, { UCSA_SYNTHETIC_VOTING_ENABLED: "true" }, { UCSA_PUBLIC_REGISTRATION_ENABLED: "true" }])
    assert.ok(deploymentEnvironmentErrors({ ...fictional, ...changes }).length);
  for (const origin of ["http://localhost:3000", "https://your-domain.example", "https://elections.example.org/account", "https://user:pass@elections.example.org", "https://elections.example.org?x=1"])
    assert.ok(deploymentEnvironmentErrors({ ...fictional, UCSA_SITE_URL: origin }).length);
});
test("rejects test credentials, public secrets and placeholders without revealing values", () => {
  const errors = deploymentEnvironmentErrors({ ...fictional, SUPABASE_TEST_SECRET_KEY: "sensitive-test-value", NEXT_PUBLIC_PRIVATE_KEY: "sensitive-private-value", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_replace_me" });
  assert.equal(errors.length, 3);
  assert.ok(!errors.join().includes("sensitive-"));
});
