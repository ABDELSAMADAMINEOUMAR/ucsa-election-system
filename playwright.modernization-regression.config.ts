import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Port 3000 is already allowed by this project's local Auth callbacks.
// An isolated production runtime avoids first-compile latency on the owner's dev server.
export default defineConfig({
  ...base,
  workers: 2,
  timeout: 120_000,
  testMatch: [
    "auth.integration.spec.ts",
    "journeys.spec.ts",
    "phase4.spec.ts",
    "phase4.pdf.spec.ts",
    "nomination.integration.spec.ts",
    "phase5.security.spec.ts",
    "phase6.headers.spec.ts",
    "logic.spec.ts",
    "registration.ui.spec.ts",
  ],
  outputDir: "test-results/modernization-regression",
  use: { ...base.use, baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "true" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
