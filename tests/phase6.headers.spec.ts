import { test, expect } from "@playwright/test";

test("production CSP restricts execution and network access without blocking navigation", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/violates.*Content Security Policy|Refused to (execute|connect|load)/i.test(message.text())) violations.push(message.text());
  });
  const response = await page.goto("/student/candidates");
  const headers = response!.headers();
  const policy = headers["content-security-policy"];
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("connect-src 'self' blob:");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toMatch(/img-src[^;]*\shttps:(?:\s|;)/);
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  await page.locator(".candidate-card").first().getByRole("link", { name: "View profile" }).click();
  await expect(page.getByRole("heading", { name: "Manifesto" })).toBeVisible();
  expect(violations).toEqual([]);
});

test("protected responses and sign-in redirects prohibit shared caching", async ({ request }) => {
  for (const path of ["/account/student/applications", "/api/account/applications/not-a-real-id"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.status()).toBe(path.startsWith("/api/") ? 401 : 307);
  }
});
