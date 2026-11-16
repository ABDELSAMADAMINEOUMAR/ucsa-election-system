import { test, expect } from "@playwright/test";

test("management homepage stays clear and usable at desktop and mobile sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Your voice.*Your UCSA elections/ })).toBeVisible();
    await expect(page.locator(".deployment-notice")).toHaveCount(1);
    await expect(page.locator(".deployment-notice")).toContainText("Online voting is currently unavailable");
    await expect(page.locator(".deployment-notice")).toContainText("Use fictional data");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create an account/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Membership administration" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Candidate review" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Complaints and certification" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("management deployment rejects ballot submission before any account or database work", async ({ request }) => {
  const response = await request.post("/api/account/elections/00000000-0000-4000-8000-000000000001/ballot", {
    data: { selections: [] },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.json()).error).toContain("Real electronic voting is not authorized");
});

test("health endpoint declares the disabled real-voting boundary", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toMatchObject({ status: "ok", realVotingEnabled: false });
});
