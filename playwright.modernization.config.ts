import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: ["bulk.logic.spec.ts", "modernization.ui.spec.ts"],
  workers: 1,
  fullyParallel: false,
  outputDir: "test-results/modernization",
  use: { ...base.use, baseURL: "http://localhost:3110", trace: "off" },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3110",
    url: "http://127.0.0.1:3110",
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "false" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
