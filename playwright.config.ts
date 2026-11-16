import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results/base",
  fullyParallel: true,
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    // The isolated local stack is used only with fictional test accounts.
    // Production registration remains disabled unless its release gate is
    // explicitly configured in the production host.
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "true" },
    url: "http://localhost:3100",
    // A reused next start process may serve stale manifests/CSS after a new
    // production build. Always launch the server for this test run.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
