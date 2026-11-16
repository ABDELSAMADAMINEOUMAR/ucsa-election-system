import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Review the already-running local app; do not stop it or change its flags.
// Select only the non-provisioning tests listed in LOCAL_COMMITTEE_BOOTSTRAP.md.
export default defineConfig({
  ...base,
  testMatch: ["auth.integration.spec.ts", "phase5.security.spec.ts"],
  grep: /registration, email verification|invalid credentials|generated local credential|stream bounds|interrupted upload|anonymous JSON|all private report/,
  outputDir: "test-results/local-auth-review",
  webServer: undefined,
  use: { ...base.use, baseURL: "http://localhost:3100", trace: "off" },
});
