import { expect, test } from "@playwright/test";

test("production registration is closed in the page and API", async ({ page, request, baseURL }) => {
  await page.goto("/account/register");
  await expect(page.getByText(/Online student registration is currently closed/)).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Go to secure sign in" })).toHaveAttribute("href", "/account/sign-in");
  const response = await request.post("/api/account/register", {
    headers: { Origin: new URL(baseURL!).origin },
    data: { fullName: "Fictional Student", email: "closed@example.test", password: "Fictional-Password-2026!" },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "Online student registration is currently closed." });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("registration retains its cross-origin request protection", async ({ request }) => {
  const response = await request.post("/api/account/register", {
    headers: { Origin: "https://untrusted.example.test" }, data: {},
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "Request origin is not allowed." });
});
