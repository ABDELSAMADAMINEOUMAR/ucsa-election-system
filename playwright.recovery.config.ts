import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "recovery.check.ts",
    "auth-redirect.logic.spec.ts",
    "recovery-delivery.logic.spec.ts",
    "registration-closed.check.ts",
  ],
  outputDir: "test-results/recovery",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3114",
    channel: "msedge",
    // Recovery links, cookies and request bodies must never enter artifacts.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3114",
    url: "http://127.0.0.1:3114/account/reset-password",
    env: {
      UCSA_PUBLIC_REGISTRATION_ENABLED: "false",
      UCSA_DEPLOYMENT_MODE: "management",
      UCSA_SYNTHETIC_VOTING_ENABLED: "false",
      UCSA_SITE_URL: "http://127.0.0.1:3114",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
