import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (
  !/^http:\/\/(?:127\.0\.0\.1|localhost):55021$/.test(authUrl ?? "") ||
  !process.env.SUPABASE_TEST_SECRET_KEY
)
  throw new Error(
    "Recovery tests require the existing local fictional Supabase stack; production is forbidden.",
  );
const admin = createClient(authUrl!, process.env.SUPABASE_TEST_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function recoveryMail(request: APIRequestContext, email: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await request.get(
      "http://127.0.0.1:55024/api/v1/messages",
    );
    const data = await response.json();
    const message = data.messages?.find(
      (m: { To?: { Address: string }[]; Subject: string }) =>
        m.To?.some((to) => to.Address === email) && /reset/i.test(m.Subject),
    );
    if (message) {
      const detail = await request.get(
        `http://127.0.0.1:55024/api/v1/message/${encodeURIComponent(message.ID)}`,
      );
      const mail = await detail.json();
      const body = `${mail.Text ?? ""}\n${mail.HTML ?? ""}`
        .replaceAll("&amp;", "&")
        .replaceAll("&#x3D;", "=");
      const link = body.match(
        /http:\/\/(?:127\.0\.0\.1|localhost):55021\/auth\/v1\/verify\?[^\s"'<>]+/,
      )?.[0];
      if (!link)
        throw new Error(
          "Synthetic recovery email has no verification link; contents suppressed.",
        );
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "Synthetic recovery email was not delivered to local Mailpit.",
  );
}

async function openEmail(page: Page, link: string) {
  try {
    await page.goto(link);
  } catch {
    throw new Error("Recovery navigation failed; credential URL suppressed.");
  }
}

test("closed registration still offers password recovery without registration prompts", async ({
  page,
}) => {
  await page.goto("/account/sign-in");
  await expect(
    page.getByRole("link", { name: "Create a student account" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Account email")).toBeVisible();
  await expect(
    page.locator("input[name=registrationNumber]:visible"),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Email confirmation and an approved register match are required for student access.",
      { exact: false },
    ),
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toBeVisible();
});

test("invalid and missing recovery sessions return to recovery with safe errors", async ({
  page,
  request,
}) => {
  for (const path of [
    "/account/recovery",
    "/account/recovery?code=invalid-synthetic-code",
    "/account/recovery?error=access_denied&error_description=sensitive-provider-detail&next=/account/register",
    "/account/callback?next=%2Faccount%2Freset-password%2Fnew",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location).pathname).toBe(
      "/account/reset-password",
    );
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers().location).not.toContain(
      "sensitive-provider-detail",
    );
  }
  await page.goto("/account/reset-password/new");
  await expect(
    page.getByRole("heading", { name: "Reset your password.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/This reset link is invalid/)).toBeVisible();
  const denied = await request.post("/api/account/password-update", {
    headers: { Origin: "http://127.0.0.1:3114" },
    data: { password: randomBytes(24).toString("hex") + "A1" },
  });
  expect(denied.status()).toBe(401);
  const crossOrigin = await request.post("/api/account/password-reset", {
    headers: { Origin: "https://untrusted.example" },
    data: { email: "fictional@example.test" },
  });
  expect(crossOrigin.status()).toBe(403);
});

test("opening a synthetic recovery email in another browser fails safely without changing its password", async ({
  page,
  request,
  browser,
}) => {
  const email = `recovery-browser-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("hex") + "A1";
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error(
      "Local synthetic account setup failed; provider details suppressed.",
    );
  const id = created.data.user.id;
  const other = await browser.newContext();
  try {
    await page.goto("/account/reset-password");
    await page.getByLabel("Account email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByText(/If an account exists for this address/),
    ).toBeVisible();
    const link = await recoveryMail(request, email);
    const otherPage = await other.newPage();
    await openEmail(otherPage, link);
    await expect
      .poll(() => new URL(otherPage.url()).pathname)
      .toBe("/account/reset-password");
    await expect(
      otherPage.getByText(/This reset link is invalid/),
    ).toBeVisible();
    const denied = await other.request.post(
      "http://127.0.0.1:3114/api/account/password-update",
      {
        headers: { Origin: "http://127.0.0.1:3114" },
        data: { password: randomBytes(24).toString("hex") + "B2" },
      },
    );
    expect(denied.status()).toBe(401);
    const unchanged = await other.request.post(
      "http://127.0.0.1:3114/api/account/sign-in",
      {
        headers: { Origin: "http://127.0.0.1:3114" },
        data: { email, password },
      },
    );
    expect(unchanged.status()).toBe(200);
  } finally {
    await other.close();
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error)
      throw new Error(
        "Local synthetic account cleanup failed; provider details suppressed.",
      );
  }
});

test("synthetic email, PKCE callback, password replacement and replay rejection work with registration closed", async ({
  page,
  request,
  browser,
}) => {
  const email = `recovery-${randomUUID()}@example.test`;
  const oldPassword = randomBytes(24).toString("hex") + "A1";
  const newPassword = randomBytes(24).toString("hex") + "B2";
  const created = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error(
      "Local synthetic account setup failed; provider details suppressed.",
    );
  const id = created.data.user.id;
  try {
    await page.goto("/account/reset-password");
    await page.getByLabel("Account email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByText(/If an account exists for this address/),
    ).toBeVisible();
    const link = await recoveryMail(request, email);
    // Assert only the non-secret callback, never the email URL/token.
    expect(new URL(link).searchParams.get("redirect_to")).toBe(
      "http://127.0.0.1:3114/account/recovery",
    );
    await openEmail(page, link);
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/account/reset-password/new");
    await page.locator("input[name=password]:visible").fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/account/sign-in");
    await page.request.post("/api/account/sign-out", {
      headers: { Origin: "http://127.0.0.1:3114" },
    });
    const wrong = await page.request.post("/api/account/sign-in", {
      headers: { Origin: "http://127.0.0.1:3114" },
      data: { email, password: oldPassword },
    });
    expect(wrong.status()).toBe(401);
    await page.goto("/account/sign-in");
    await page.getByLabel("Student email").fill(email);
    await page.locator("input[name=password]:visible").fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe("/account/activate");
    const memberships = await admin
      .from("committee_members")
      .select("id")
      .eq("user_id", id);
    expect(memberships.data?.length).toBe(0);
    const other = await browser.newContext();
    try {
      const replay = await other.newPage();
      await openEmail(replay, link);
      await expect
        .poll(() => new URL(replay.url()).pathname)
        .toBe("/account/reset-password");
      await expect(
        replay.getByText(/This reset link is invalid/),
      ).toBeVisible();
    } finally {
      await other.close();
    }
  } finally {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error)
      throw new Error(
        "Local synthetic account cleanup failed; provider details suppressed.",
      );
  }
});
