/** A configured origin keeps email callbacks stable behind a hosting proxy. */
export function authCallbackUrl(requestOrigin: string, next: string) {
  const configured = process.env.UCSA_SITE_URL;
  if (process.env.VERCEL_ENV === "production" && !configured)
    throw new Error("Application origin is required in production.");
  const origin = new URL(configured || requestOrigin);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    origin.username || origin.password || origin.pathname !== "/" ||
    origin.search || origin.hash ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback)) ||
    (configured && process.env.VERCEL_ENV === "production" && loopback)
  ) throw new Error("Invalid application origin configuration.");
  const callback = new URL("/account/callback", origin.origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}
