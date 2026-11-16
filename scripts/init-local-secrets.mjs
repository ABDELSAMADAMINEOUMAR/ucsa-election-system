// Generate project-specific LOCAL platform credentials. Never contact a hosted
// project, print key values, reset a database, or change Git history.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
const envPath = ".env.local";
const keyPath = "supabase/local-signing-keys.json";
const rotate = process.argv.includes("--rotate");
let environment = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const currentUrl = environment.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (currentUrl && currentUrl !== "https://your-project.supabase.co" && !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(currentUrl)) {
  throw new Error("Refusing to change credentials: the configured URL is not this project's local stack.");
}
if (existsSync(keyPath) && !rotate) {
  const configured = Object.fromEntries(environment.split(/\r?\n/).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2]]));
  const required = ["SUPABASE_LOCAL_JWT_SECRET", "SUPABASE_LOCAL_SECRET_KEY", "SUPABASE_LOCAL_PUBLISHABLE_KEY"];
  if (required.some((name) => !configured[name] || configured[name].length < 40 || /generated_by|replace_me|local_supabase/.test(configured[name])) ||
    configured.SUPABASE_LOCAL_SECRET_KEY !== configured.SUPABASE_SERVICE_ROLE_KEY || configured.SUPABASE_LOCAL_SECRET_KEY !== configured.SUPABASE_TEST_SECRET_KEY ||
    configured.SUPABASE_LOCAL_PUBLISHABLE_KEY !== configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || configured.SUPABASE_LOCAL_JWT_SECRET !== configured.SUPABASE_TEST_JWT_SECRET) {
    throw new Error("Private signing material exists but the local environment is incomplete or inconsistent. Restore the matching ignored environment or intentionally regenerate with --rotate; no files were changed.");
  }
  console.log("Local signing keys already exist; no credentials changed. Use --rotate only for an intentional local rotation.");
  process.exit(0);
}
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const signingKey = { ...privateKey.export({ format: "jwk" }), kid: randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
const jwtSecret = randomBytes(48).toString("base64url");
const secretKey = `sb_secret_${randomBytes(32).toString("base64url")}`;
const publishableKey = `sb_publishable_${randomBytes(24).toString("base64url")}`;
const values = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55021",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: secretKey,
  SUPABASE_TEST_SECRET_KEY: secretKey,
  SUPABASE_TEST_JWT_SECRET: jwtSecret,
  SUPABASE_LOCAL_JWT_SECRET: jwtSecret,
  SUPABASE_LOCAL_SECRET_KEY: secretKey,
  SUPABASE_LOCAL_PUBLISHABLE_KEY: publishableKey,
};
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${name}=.*$`, "gm");
  environment = pattern.test(environment) ? environment.replace(pattern, () => `${name}=${value}`) : `${environment.trimEnd()}\n${name}=${value}\n`;
}
writeFileSync(keyPath, `${JSON.stringify([signingKey])}\n`, { mode: 0o600 });
writeFileSync(envPath, environment, { mode: 0o600 });
console.log("Generated private local signing material and updated .env.local without printing values. Restart only this project's local stack, then rebuild the application. Existing tokens must be replaced by signing in again.");
