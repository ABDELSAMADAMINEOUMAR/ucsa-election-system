import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the production release gate without opening registration or
// contacting Auth. This process uses the same build as the normal UI checks.
export default defineConfig({
  ...base,
  testMatch: "registration-closed.check.ts",
  outputDir: "test-results/registration-closed",
  use: { ...base.use, baseURL: "http://127.0.0.1:3103" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3103",
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "false" },
    url: "http://127.0.0.1:3103",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
