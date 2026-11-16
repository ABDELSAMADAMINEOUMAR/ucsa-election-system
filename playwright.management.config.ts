import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  workers: 1,
  outputDir: "test-results/management",
  testMatch: ["management.check.ts"],
  use: { ...base.use, trace: "off" },
  webServer: {
    ...base.webServer,
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: { UCSA_DEPLOYMENT_MODE: "management", UCSA_SYNTHETIC_VOTING_ENABLED: "false", UCSA_PUBLIC_REGISTRATION_ENABLED: "false" },
  },
});
