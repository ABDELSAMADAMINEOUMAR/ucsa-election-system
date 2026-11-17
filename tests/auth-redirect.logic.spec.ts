import { test, expect } from "@playwright/test";
import {
  authCallbackUrl,
  authCallbackDestination,
  recoveryCallbackUrl,
} from "@/lib/auth-redirect";

function withOrigin(
  site: string | undefined,
  hosted: boolean,
  run: () => void,
) {
  const savedSite = process.env.UCSA_SITE_URL;
  const savedHost = process.env.VERCEL_ENV;
  try {
    if (site === undefined) delete process.env.UCSA_SITE_URL;
    else process.env.UCSA_SITE_URL = site;
    if (hosted) process.env.VERCEL_ENV = "production";
    else delete process.env.VERCEL_ENV;
    run();
  } finally {
    if (savedSite === undefined) delete process.env.UCSA_SITE_URL;
    else process.env.UCSA_SITE_URL = savedSite;
    if (savedHost === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = savedHost;
  }
}

test("Auth email callbacks use the configured canonical domain behind a proxy", () => {
  withOrigin("https://elections.example.org", true, () => {
    const callback = new URL(
      authCallbackUrl(
        "https://internal-proxy.invalid",
        "/account/reset-password/new",
      ),
    );
    expect(callback.origin).toBe("https://elections.example.org");
    expect(callback.pathname).toBe("/account/callback");
    expect(callback.searchParams.get("next")).toBe(
      "/account/reset-password/new",
    );
  });
});

test("local development can use its request origin without a hosted site setting", () => {
  withOrigin(undefined, false, () =>
    expect(
      new URL(authCallbackUrl("http://localhost:3100", "/account/activate"))
        .origin,
    ).toBe("http://localhost:3100"),
  );
});

test("recovery uses its fixed canonical callback without an activation destination", () => {
  withOrigin("https://elections.example.org", true, () => {
    expect(recoveryCallbackUrl("https://internal-proxy.invalid")).toBe(
      "https://elections.example.org/account/recovery",
    );
  });
});

test("legacy callback destinations exclude registration, external URLs and path traversal", () => {
  for (const destination of [
    null,
    "/account/register",
    "https://untrusted.example",
    "//untrusted.example",
    "/account/../../register",
    "/account/committee",
    "/account/reset-password/new?next=/account/register",
  ])
    expect(authCallbackDestination(destination)).toBe("/account");
  expect(authCallbackDestination("/account/reset-password/new")).toBe(
    "/account/reset-password/new",
  );
  expect(authCallbackDestination("/account/activate")).toBe(
    "/account/activate",
  );
});

test("hosted callbacks reject missing origins, loopback, credentials and URL suffixes", () => {
  for (const site of [
    undefined,
    "http://localhost:3100",
    "https://localhost",
    "https://user:pass@elections.example.org",
    "https://elections.example.org/path",
    "https://elections.example.org?x=1",
    "https://elections.example.org#fragment",
    "http://elections.example.org",
  ])
    withOrigin(site, true, () =>
      expect(() =>
        authCallbackUrl("https://proxy.invalid", "/account/activate"),
      ).toThrow(),
    );
});
