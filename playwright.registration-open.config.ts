import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// A dedicated loopback process avoids the interactive server on port 3100.
// Only fictional, intercepted registration requests run in this suite.
export default defineConfig({
  ...base,
  testMatch: "registration.ui.spec.ts",
  outputDir: "test-results/registration-open",
  use: { ...base.use, baseURL: "http://127.0.0.1:3102" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102",
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "true" },
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
