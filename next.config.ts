import type { NextConfig } from "next";

// Signed private images are loaded directly from the configured Storage origin.
// Only the isolated loopback test stack may use HTTP; hosted origins need HTTPS.
function storageImageOrigin() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.port === "55021")
    )
      return url.origin;
  } catch {
    /* Unconfigured services receive no external image permission. */
  }
  return "";
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF routes read bundled fonts and the logo from disk at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/reports/fonts/*.ttf", "./public/ucsa-logo.png"],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./supabase/**",
      "./tests/**",
      "./test-results/**",
      "./playwright-report/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // Next's production runtime needs inline bootstrap scripts but not eval.
          // Browser requests use our same-origin API; blob reads are local previews.
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: ${storageImageOrigin()}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; connect-src 'self' blob:`,
          },
        ],
      },
      {
        source: "/account/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
