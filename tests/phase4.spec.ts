import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const testKey = process.env.SUPABASE_TEST_SECRET_KEY;
if (!supabaseUrl || !testKey || !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(supabaseUrl)) throw new Error("Phase 4 authenticated UI test requires the disposable local Supabase stack.");
const testAdmin = createClient(supabaseUrl, testKey, { auth: { autoRefreshToken: false, persistSession: false } });

test("public result route withholds an unpublished election", async ({ page }) => {
  const response = await page.goto("/elections/65000000-0000-4000-8000-000000000099/results");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Results are not published" })).toBeVisible();
  await expect(page.getByText(/candidate votes|official winner/i)).toHaveCount(0);
});

test("confidential result PDFs require an authenticated session", async ({ request }) => {
  const response = await request.get("/api/account/elections/65000000-0000-4000-8000-000000000099/reports/certified-results");
  expect(response.status()).toBe(401);
});

test("certification workspace requires a committee session", async ({ page }) => {
  await page.goto("/account/committee/certification");
  await expect(page).toHaveURL(/\/account\/sign-in/);
});

test("official logo is served as the original image on the welcome page", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("img", { name: "Official UCSA logo" }).first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`unpublished results remain readable without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/elections/65000000-0000-4000-8000-000000000099/results");
    await expect(page.getByRole("heading", { name: "Results are not published" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test("authenticated student and committee Phase 4 pages fit mobile and desktop layouts", async ({ page }) => {
  const email = `phase4-layout-${randomUUID()}@example.test`;
  const password = `Phase4-${randomUUID()}!`;
  const { data, error } = await testAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Synthetic Phase 4 Reviewer" } });
  expect(error).toBeNull(); expect(data.user).not.toBeNull();
  try {
    const membership = await testAdmin.from("committee_members").insert({ user_id: data.user!.id, role: "committee_chair", election_id: null });
    expect(membership.error).toBeNull();
    await page.goto("/account/sign-in");
    await page.getByLabel("Student email").fill(email);
    await page.locator("input[name=password]").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/account/student/complaints", "/account/committee/complaints", "/account/committee/certification"]) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(dimensions.content, `${route} overflows at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
      }
    }
  } finally {
    await testAdmin.from("committee_members").delete().eq("user_id", data.user!.id);
    await testAdmin.auth.admin.deleteUser(data.user!.id);
  }
});
