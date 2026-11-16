import "server-only";
import { createHash, createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

/** Shared atomic counters; no untrusted X-Forwarded-For or sensitive raw keys. */
export async function publicRateLimit(
  bucket: string,
  identity: string,
  limit = 8,
) {
  const client = createSupabaseAdminClient();
  // Domain-separated keyed hash; the server-only key never leaves this module.
  const hash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`ucsa-rate:${bucket}:${identity.trim().toLowerCase()}`)
    .digest("hex");
  const global = await client.rpc("consume_public_limit", {
    bucket_input: `${bucket}-global`,
    key_input: createHash("sha256").update(`global:${bucket}`).digest("hex"),
    limit_input: 5000,
  });
  if (global.error || global.data !== true) return false;
  const result = await client.rpc("consume_public_limit", {
    bucket_input: bucket,
    key_input: hash,
    limit_input: limit,
  });
  return !result.error && result.data === true;
}
