import { expect, test } from "@playwright/test";

const confirmationMessage =
  "If this request can proceed, email confirmation instructions will be sent. Confirm your email, then activate using your official registration number.";

test("homepage separates Phase 1 demo entry from secure registration and sign-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByText("Explore the separate fictional demonstration", { exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Student portal demo", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  await expect(
    page.getByRole("link", { name: "Committee demo", exact: true }),
  ).toHaveAttribute("href", "/committee");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/account\/register$/);
  await expect(page.getByLabel("UNILAK registration number")).toBeVisible();
  await expect(page.getByLabel("Student email")).toBeVisible();
  await expect(page.locator("input[name=password]")).toBeVisible();
  await expect(
    page.getByText(/Creating an account never grants committee privileges/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to Phase 1 demo entry" }),
  ).toHaveAttribute("href", "/sign-in");

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await expect(page.getByLabel("Student email")).toBeVisible();
});

test("registration shows an enumeration-safe confirmation state and restores the form on reload", async ({
  page,
}) => {
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route("**/api/account/register", async (route) => {
    submittedPayload = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      json: { message: confirmationMessage },
      headers: { "Cache-Control": "private, no-store" },
    });
  });
  await page.goto("/account/register");
  await page
    .getByLabel("UNILAK registration number")
    .fill("REG-FICTIONAL-TEST");
  await page.getByLabel("Student email").fill("fictional-student@example.test");
  await page.locator("input[name=password]").fill("Fictional-Password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText(confirmationMessage)).toBeVisible();
  expect(submittedPayload).toEqual({
    registrationNumber: "REG-FICTIONAL-TEST",
    email: "fictional-student@example.test",
    password: "Fictional-Password-2026!",
  });
  await expect(
    page.getByRole("link", { name: "Return to secure sign in" }),
  ).toHaveAttribute("href", "/account/sign-in");
  await expect(page.getByLabel("UNILAK registration number")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Return to registration form" })
    .click();
  await expect(page.getByLabel("UNILAK registration number")).toHaveValue("");
  await expect(page.getByLabel("Student email")).toHaveValue("");
  await expect(page.locator("input[name=password]")).toHaveValue("");
  await page
    .getByLabel("UNILAK registration number")
    .fill("REG-FICTIONAL-TEST");
  await page.getByLabel("Student email").fill("fictional-student@example.test");
  await page.locator("input[name=password]").fill("Fictional-Password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status").filter({ hasText: confirmationMessage })).toContainText(confirmationMessage);

  await page.reload();
  await expect(page.getByLabel("UNILAK registration number")).toBeVisible();
  await expect(page.getByText(confirmationMessage)).toHaveCount(0);
});

test("a failed registration keeps the form available for retry", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/account/register", (route) =>
    route.fulfill({
      status: ++attempts === 1 ? 503 : 200,
      json:
        attempts === 1
          ? { error: "Online student registration is currently closed." }
          : { message: confirmationMessage },
    }),
  );
  await page.goto("/account/register");
  await page
    .getByLabel("UNILAK registration number")
    .fill("REG-FICTIONAL-TEST");
  await page.getByLabel("Student email").fill("fictional-student@example.test");
  await page.locator("input[name=password]").fill("Fictional-Password-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Online student registration is currently closed.",
  );
  await expect(page.getByLabel("UNILAK registration number")).toHaveValue(
    "REG-FICTIONAL-TEST",
  );
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toBeEnabled();
  await expect(page.getByText(confirmationMessage)).toHaveCount(0);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status").filter({ hasText: confirmationMessage })).toContainText(confirmationMessage);
  await expect(page.locator("form")).toHaveCount(0);
  expect(attempts).toBe(2);
});
