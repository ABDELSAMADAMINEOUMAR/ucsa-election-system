import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import base from "./playwright.config";

loadEnvConfig(process.cwd());
if (
  !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  )
) {
  throw new Error(
    "Official-register verification requires the UCSA local Supabase stack.",
  );
}

export default defineConfig({
  ...base,
  workers: 1,
  fullyParallel: false,
  testMatch: ["*.spec.ts"],
  outputDir: "test-results/official-register",
  use: { ...base.use, baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: { UCSA_PUBLIC_REGISTRATION_ENABLED: "true" },
    timeout: 120000,
  },
});
