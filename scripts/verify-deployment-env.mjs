// Validate names and shapes only. Never print values or contact a provider.
import { pathToFileURL } from "node:url";
export function deploymentEnvironmentErrors(env) {
  const errors = [];
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) throw new Error();
  } catch { errors.push("NEXT_PUBLIC_SUPABASE_URL must be the managed project's HTTPS origin."); }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "")) errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable project key.");
  // The existing server variable also accepts a modern secret API key.
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SUPABASE_SERVICE_ROLE_KEY ?? "")) errors.push("SUPABASE_SERVICE_ROLE_KEY must contain the managed project's server-only secret API key.");
  for (const name of Object.keys(env)) {
    if (/^SUPABASE_(?:TEST_|LOCAL_)/.test(name) && env[name]) errors.push(`${name} is local/test-only; remove it from hosted environments.`);
    if (/^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PASSWORD|PRIVATE)/i.test(name) && env[name]) errors.push(`${name} must never be public.`);
  }
  const values = [env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, env.SUPABASE_SERVICE_ROLE_KEY];
  if (values.some(value => /replace|placeholder|generated_by|example/i.test(value ?? ""))) errors.push("Replace credential placeholders through the provider secret store.");
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = deploymentEnvironmentErrors(process.env);
  if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
  else console.log("Deployment environment shape checks passed; project matching, revocation and hosted settings require separate verification.");
}
