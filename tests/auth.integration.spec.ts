import AxeBuilder from "@axe-core/playwright";
import { boundFixture } from "./official-fixtures";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_TEST_SECRET_KEY;
const jwtSecret = process.env.SUPABASE_TEST_JWT_SECRET;
if (
  !url ||
  !publishableKey ||
  !serviceKey ||
  !jwtSecret ||
  !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(url)
) {
  throw new Error(
    "Authentication integration tests require the configured disposable local Supabase stack.",
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const mailpit = "http://127.0.0.1:55024/api/v1";
const initialPassword = "UCSA-Phase2-Integration-2026!";
const updatedPassword = "UCSA-Phase2-Updated-2026!";

type Mail = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Text?: string;
  HTML?: string;
  Created?: string;
};
async function waitForMail(
  request: APIRequestContext,
  email: string,
  since: number,
  subject?: RegExp,
) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await request.get(`${mailpit}/messages`);
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as { messages?: Mail[] };
    const found = (payload.messages ?? []).find(
      (message) =>
        message.To?.some(
          (to) => to.Address.toLowerCase() === email.toLowerCase(),
        ) &&
        (!message.Created || Date.parse(message.Created) >= since) &&
        (!subject || subject.test(message.Subject)),
    );
    if (found) {
      const detail = await request.get(
        `${mailpit}/message/${encodeURIComponent(found.ID)}`,
      );
      expect(detail.ok()).toBeTruthy();
      return (await detail.json()) as Mail;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Expected local account email was not delivered to Mailpit.");
}

function verificationLink(message: Mail) {
  const body = `${message.Text ?? ""}\n${message.HTML ?? ""}`
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("&quot;", '"');
  const link = body.match(
    /https?:\/\/(?:127\.0\.0\.1|localhost):55021\/auth\/v1\/verify\?[^\s"'<>]+/,
  )?.[0];
  if (!link)
    throw new Error("Local account email did not include a verification link.");
  return link;
}

async function fillAccount(page: Page, email: string, password: string) {
  await page.goto("/account/sign-in");
  await page.getByLabel("Student email").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("registration, email verification, student status, password recovery and sign-out work with local Auth", async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const email = `phase2-${randomUUID()}@example.test`;
  const registration = `AUTH-${randomUUID().slice(0, 24).toUpperCase()}`;
  const contextStart = Date.now() - 1000;
  await page.goto("/account/register");
  await page.getByLabel("UNILAK registration number").fill(registration);
  await page.getByLabel("Student email").fill(email);
  await page.locator("input[name=password]").fill(initialPassword);
  let registrationStatus = 0;
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/account/register")
      registrationStatus = response.status();
  });
  await page.getByRole("button", { name: "Create account" }).click();
  const confirmationMessage =
    "If this request can proceed, email confirmation instructions will be sent. Confirm your email, then activate using your official registration number.";
  await expect(page.getByText(confirmationMessage)).toBeVisible();
  expect(registrationStatus).toBe(200);

  // The request fixture has a separate cookie jar. A second signup in the
  // browser would replace the PKCE verifier for its pending confirmation.
  const duplicateResponse = await request.post("/api/account/register", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      registrationNumber: registration,
      email,
      password: initialPassword,
    },
  });
  const duplicate = {
    status: duplicateResponse.status(),
    body: await duplicateResponse.json(),
  };
  expect(duplicate).toEqual({
    status: 200,
    body: { message: confirmationMessage },
  });

  const confirmation = await waitForMail(
    request,
    email,
    contextStart,
    /confirm|verify/i,
  );
  await page.goto(verificationLink(confirmation));
  await expect(page).toHaveURL(/\/account\/activate$/);
  await expect(
    page.getByRole("heading", { name: "Complete your account activation" }),
  ).toBeVisible();
  await page.goto("/account/student");
  await expect(page).toHaveURL(/\/account\/activate$/);
  await page
    .getByRole("button", { name: "Activate my account", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "Unable to activate",
  );
  const rosterResponse = await page.request.get("/api/account/roster");
  expect(rosterResponse.status()).toBe(403);

  const identity = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  expect(identity.error).toBeNull();
  await boundFixture(admin, [identity.data!.id], [], false, {
    registrationNumber: registration,
    fullName: "Synthetic Student",
  });
  // Real simultaneous activation requests; idempotence must preserve one audit.
  const activations = await Promise.all(
    [1, 2].map(() =>
      page.request.post("/api/account/activation", {
        headers: { Origin: new URL(baseURL!).origin },
        data: { registrationNumber: registration },
      }),
    ),
  );
  expect(activations.map((r) => r.status())).toEqual([200, 200]);
  await page
    .getByRole("button", { name: "Activate my account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/student$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Synthetic." }),
  ).toBeVisible();
  expect(
    (
      await admin
        .from("admin_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", identity.data!.id)
        .eq("action", "official_voter_activated")
    ).count,
  ).toBe(1);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/account/student",
      "/account/student/vote",
      "/account/student/applications",
      "/account/student/settings",
      "/account/student/help",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1:visible")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/account/student");
    if (width === 390 || width === 1440) {
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
      await page.screenshot({
        path: `test-results/official-register/student-${width === 390 ? "mobile" : "desktop"}.png`,
        fullPage: true,
      });
    }
  }
  const recoveryStart = Date.now() - 1000;
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await page.goto("/account/reset-password");
  await page.getByLabel("Student email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(/If an account exists for this address/),
  ).toBeVisible();
  const recovery = await waitForMail(request, email, recoveryStart, /reset/i);
  await page.goto(verificationLink(recovery));
  await expect(page).toHaveURL(/\/account\/reset-password\/new$/);
  await page.locator("input[name=password]").fill(updatedPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in\?notice=password-updated$/);
  await fillAccount(page, email, updatedPassword);
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await page.goto("/account/student");
  await expect(page).toHaveURL(/\/account\/sign-in/);
});

test("invalid credentials, ordinary-student committee isolation and expired sessions are enforced", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const email = `expiry-${randomUUID()}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { full_name: "Expiry Test" },
  });
  expect(error).toBeNull();
  expect(data.user).not.toBeNull();

  await fillAccount(page, email, "Incorrect-Password-2026!");
  await expect(page.locator("p[role=alert]")).toContainText("incorrect");
  await fillAccount(page, email, initialPassword);
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);

  // An unlisted Auth account must retain help/recovery without portal access.
  expect((await page.request.get("/help")).status()).toBe(200);
  const recoveryStarted = Date.now() - 1000;
  const recoveryResponse = await page.request.post(
    "/api/account/password-reset",
    {
      headers: { Origin: new URL(baseURL!).origin },
      data: { email },
    },
  );
  expect(recoveryResponse.status()).toBe(200);
  expect((await recoveryResponse.json()).message).toContain(
    "If an account exists",
  );
  await waitForMail(request, email, recoveryStarted, /reset/i);

  const storageKey = (await context.cookies()).find((cookie) =>
    /^sb-.+-auth-token$/.test(cookie.name),
  );
  expect(storageKey).toBeTruthy();
  const sessionValue = storageKey!.value.startsWith("base64-")
    ? storageKey!.value.slice(7)
    : storageKey!.value;
  const storedSession = JSON.parse(
    Buffer.from(sessionValue, "base64url").toString("utf8"),
  ) as { access_token: string };
  // Use the ordinary student's token, never the privileged test client, for
  // these checks. Rejected writes must not create a registry membership.
  const studentClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${storedSession.access_token}` },
    },
  });
  const assignment = await studentClient.from("committee_members").insert({
    user_id: data.user!.id,
    role: "committee_chair",
    election_id: null,
  });
  expect(assignment.error?.code).toBe("42501");
  const managed = await studentClient.rpc("manage_committee_member", {
    user_id_input: data.user!.id,
    role_input: "election_administrator",
    election_id_input: null,
    action_input: "add",
  });
  expect(managed.error?.message).toContain("Not authorized");
  const roleCheck = await studentClient.rpc("has_committee_role", {
    allowed: ["committee_chair", "election_administrator"],
  });
  expect(roleCheck.error).toBeNull();
  expect(roleCheck.data).toBe(false);
  const registry = await studentClient.from("committee_members").select("role");
  expect(registry.error).toBeNull();
  expect(registry.data).toEqual([]);
  await page.goto("/account/committee");
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
  expect(
    (await page.request.get("/api/account/committee-members")).status(),
  ).toBe(403);
  const roleRequest = await page.request.post(
    "/api/account/committee-members",
    {
      headers: { Origin: new URL(baseURL!).origin },
      data: {
        userId: data.user!.id,
        role: "election_administrator",
        electionId: null,
        action: "add",
      },
    },
  );
  expect(roleRequest.status()).toBe(403);
  const stillUnprivileged = await studentClient.rpc("has_committee_role", {
    allowed: ["committee_chair", "election_administrator"],
  });
  expect(stillUnprivileged.error).toBeNull();
  expect(stillUnprivileged.data).toBe(false);
  const privateUpload = await request
    .post(
      `${url}/storage/v1/object/candidate-private/${data.user!.id}/${randomUUID()}/portrait.webp`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${storedSession.access_token}`,
          "Content-Type": "image/webp",
        },
        data: Buffer.from("not-an-authorized-application-photo"),
      },
    )
    .catch(() => {
      throw new Error(
        "Local private Storage test transport failed; sensitive request details withheld.",
      );
    });
  expect([400, 403]).toContain(privateUpload.status());
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const claims = encode({
    sub: data.user!.id,
    aud: "authenticated",
    role: "authenticated",
    iss: `${url}/auth/v1`,
    iat: now - 3600,
    exp: now - 60,
    email,
  });
  const unsigned = `${header}.${claims}`;
  const expiredToken = `${unsigned}.${createHmac("sha256", jwtSecret).update(unsigned).digest("base64url")}`;
  const expiredSession = Buffer.from(
    JSON.stringify({
      access_token: expiredToken,
      token_type: "bearer",
      expires_in: 0,
      expires_at: now - 60,
      refresh_token: "invalid-revoked-session",
      user: data.user,
    }),
  ).toString("base64url");
  await context.clearCookies();
  await context.addCookies([
    {
      name: storageKey!.name,
      value: `base64-${expiredSession}`,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/account/student");
  await expect(page).toHaveURL(/\/account\/sign-in/);
  const privateResponse = await page.request.get(
    "/api/account/verification-requests",
  );
  expect(privateResponse.status()).toBe(401);
});
