import { retainFixtureAuth } from "./official-fixtures";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_TEST_SECRET_KEY;
if (url !== "http://127.0.0.1:55021" || !key)
  throw new Error(
    "Modernization UI tests require the isolated local Supabase project.",
  );
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const suffix = randomUUID();
const password = `Fixture-${randomUUID()}!`;
const chairEmail = `modernization-chair-${suffix}@example.test`;
const studentEmail = `modernization-student-${suffix}@example.test`;
const registration = `UI-${suffix.slice(0, 18).toUpperCase()}`;
let chairId = "";
let studentId = "";
let requestId = "";
async function login(page: Page, email: string) {
  await page.goto("/account/sign-in");
  await page.getByLabel("Student email").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
}

test.beforeAll(async () => {
  for (const [email, name, kind] of [
    [chairEmail, "Modernization test chair", "chair"],
    [studentEmail, "Modernization test student", "student"],
  ]) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    expect(created.error).toBeNull();
    expect(created.data.user).toBeTruthy();
    if (kind === "chair") chairId = created.data.user!.id;
    else studentId = created.data.user!.id;
  }
  // Node-only fixture provisioning in the strictly guarded loopback project;
  // never an application authorization path or a real account promotion.
  expect(
    (
      await admin.from("committee_members").insert({
        user_id: chairId,
        role: "committee_chair",
        election_id: null,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from("eligible_students").insert({
        registration_number: registration,
        verified_email: studentEmail,
        roster_status: "approved",
      })
    ).error,
  ).toBeNull();
  const request = await admin
    .from("student_verification_requests")
    .insert({ user_id: studentId, requested_registration_number: registration })
    .select("id")
    .single();
  expect(request.error).toBeNull();
  requestId = request.data!.id;
});

test.afterAll(async () => {
  // Remove only UUIDs/registration created by this run, never pre-existing data.
  if (requestId) {
    expect(
      (
        await admin
          .from("verification_history")
          .delete()
          .eq("request_id", requestId)
          .eq("user_id", studentId)
      ).error,
    ).toBeNull();
    expect(
      (
        await admin
          .from("admin_audit_events")
          .delete()
          .eq("entity_id", requestId)
          .eq("actor_id", chairId)
      ).error,
    ).toBeNull();
  }
  if (requestId)
    expect(
      (
        await admin
          .from("student_verification_requests")
          .delete()
          .eq("id", requestId)
          .eq("user_id", studentId)
      ).error,
    ).toBeNull();
  if (studentId)
    expect(
      (
        await admin
          .from("eligible_students")
          .delete()
          .eq("registration_number", registration)
          .eq("verified_email", studentEmail)
      ).error,
    ).toBeNull();
  if (chairId) {
    expect(
      (await admin.from("committee_members").delete().eq("user_id", chairId))
        .error,
    ).toBeNull();
    expect((await retainFixtureAuth(chairId)).error).toBeNull();
  }
  if (studentId) expect((await retainFixtureAuth(studentId)).error).toBeNull();
});

test("authorized workspaces are responsive, branded, keyboard navigable and accessible", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await login(page, chairEmail);
  const routes = [
    "/account/committee",
    "/account/committee/verification",
    "/account/committee/roster",
    "/account/committee/eligibility",
    "/account/committee/candidates",
    "/account/committee/elections",
    "/account/committee/members",
    "/account/student",
    "/account/student/settings",
  ];
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      if (route.startsWith("/account/student")) {
        await expect(page).toHaveURL(/\/account\/activate$/);
        await expect(
          page.getByRole("heading", {
            name: "Complete your account activation",
          }),
        ).toBeVisible();
      }
      await expect(page.locator("main h1:visible")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Workspace unavailable" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account/committee");
  const menu = page.getByRole("button", { name: "Open workspace navigation" });
  await menu.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Administration" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await page.screenshot({
    path: "test-results/modernization/committee-mobile.png",
    fullPage: true,
  });
  for (const route of [
    "/account/committee",
    "/account/committee/verification",
    "/account/committee/roster",
    "/account/committee/members",
    "/account/student",
  ]) {
    await page.goto(route);
    if (route.startsWith("/account/student")) {
      await expect(page).toHaveURL(/\/account\/activate$/);
      await expect(
        page.getByRole("heading", { name: "Complete your account activation" }),
      ).toBeVisible();
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((item) => ({
        id: item.id,
        targets: item.nodes.map((node) => node.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/account/committee");
  await page.screenshot({
    path: "test-results/modernization/committee-desktop.png",
    fullPage: true,
  });
});

test("official import stages duplicate rows without granting access", async ({
  page,
}) => {
  await login(page, chairEmail);
  await page.goto("/account/committee/roster");
  await page.getByLabel("Register title").fill("Synthetic validation preview");
  for (const [name, value] of [
    ["Membership registration opens", "2026-01-01T08:00"],
    ["Membership registration closes", "2026-01-02T17:00"],
    ["Account activation opens", "2026-01-03T08:00"],
    ["Account activation closes", "2027-01-01T17:00"],
  ])
    await page.getByLabel(name, { exact: false }).fill(value);
  await page
    .getByLabel("Source approval / change reason")
    .fill("Synthetic successor validation exercise");
  await page.getByLabel("Official voter file").setInputFiles({
    name: "duplicate.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "full_name,registration_number,email\nFictional One,DUP-001,one@example.test\nFictional Two,DUP-001,two@example.test",
    ),
  });
  await page
    .getByRole("button", { name: "Upload and preview", exact: true })
    .click();
  await expect(page.getByText(/2 invalid/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review approval and lock" }),
  ).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "No voter access has been granted" })).toContainText(
    "No voter access has been granted",
  );
});

test("bulk verification exposes exact matches, confirms decisions and displays per-record outcomes", async ({
  page,
}) => {
  await login(page, chairEmail);
  await page.goto("/account/committee/verification");
  await page.getByLabel("Rows per page").selectOption("100");
  await expect(page.getByLabel("Rows per page")).toHaveValue("100");
  const row = page.getByRole("row").filter({ hasText: studentEmail });
  await expect(row).toContainText("Exact match");
  let calls = 0;
  await page.route(
    "**/api/account/verification-requests/bulk",
    async (route) => {
      calls++;
      const payload = route.request().postDataJSON();
      expect(payload.ids).toEqual([requestId]);
      expect(payload.confirmed).toBe(true);
      await route.fulfill({
        json: {
          results: [
            {
              request_id: requestId,
              success: calls === 1,
              error_code: calls === 1 ? null : "not_pending",
            },
          ],
        },
      });
    },
  );
  await page
    .getByRole("checkbox", {
      name: "Select Modernization test student",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Approve selected", exact: true })
    .click();
  expect(calls).toBe(0);
  await expect(page.getByRole("dialog")).toContainText("1 selected request");
  await page.getByRole("button", { name: "Confirm approval of 1" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 succeeded; 0 not completed" })).toContainText(
    "1 succeeded; 0 not completed",
  );
  await expect(
    page.getByRole("checkbox", {
      name: "Select Modernization test student",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("checkbox", {
      name: "Select Modernization test student",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Reject selected", exact: true })
    .click();
  const confirm = page.getByRole("button", { name: "Confirm rejection of 1" });
  await expect(confirm).toBeDisabled();
  await page
    .getByLabel("Reason for rejection (required)")
    .fill("Reviewed mismatch in fictional test");
  await confirm.click();
  await expect(page.getByRole("status").filter({ hasText: "0 succeeded; 1 not completed" })).toContainText(
    "0 succeeded; 1 not completed",
  );
  await expect(page.getByText(/Already reviewed or unavailable/)).toBeVisible();
});

test("ordinary students cannot reach committee routes or new bulk and roster APIs", async ({
  page,
  baseURL,
}) => {
  await login(page, studentEmail);
  await page.goto("/account/committee");
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
  const payloads = [
    [
      "/api/account/verification-queue",
      { page: 1, size: 25, search: "", status: "pending" },
    ],
    [
      "/api/account/verification-requests/bulk",
      { ids: [requestId], decision: "verified", reason: "", confirmed: true },
    ],
    ["/api/account/roster/list", { page: 1, search: "" }],
    [
      "/api/account/roster/preview",
      { records: [{ registrationNumber: "UI-ONE", email: studentEmail }] },
    ],
    [
      "/api/account/roster/import",
      {
        records: [
          { registrationNumber: "UI-ONE", email: studentEmail, expected: null },
        ],
        confirmed: true,
      },
    ],
    ["/api/account/committee-accounts", { search: "modernization" }],
    [
      "/api/account/election-eligibility/bulk",
      {
        electionId: randomUUID(),
        ids: [studentId],
        decision: "verified",
        confirmed: true,
      },
    ],
  ] as const;
  for (const [path, data] of payloads) {
    const response = await page.request.post(path, {
      headers: { Origin: new URL(baseURL!).origin },
      data,
    });
    expect(response.status(), path).toBe(403);
    const cross = await page.request.post(path, {
      headers: { Origin: "https://untrusted.example.test" },
      data,
    });
    expect(cross.status()).toBe(403);
  }
  await page.goto("/account/student");
  await expect(
    page.getByRole("heading", { name: "Complete your account activation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Administration", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("real concurrent bulk requests create one decision, one history and one responsible-officer audit", async ({
  page,
  baseURL,
}) => {
  await login(page, chairEmail);
  const ids = [requestId, randomUUID()];
  const responses = await Promise.all(
    [1, 2].map(() =>
      page.request.post("/api/account/verification-requests/bulk", {
        headers: { Origin: new URL(baseURL!).origin },
        data: {
          ids,
          decision: "verified",
          reason: "Exact fictional fixture match",
          confirmed: true,
        },
      }),
    ),
  );
  const outcomes = [];
  for (const response of responses) {
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(2);
    outcomes.push(...body.results);
  }
  expect(outcomes.filter((row) => row.success)).toHaveLength(1);
  expect(
    outcomes.filter(
      (row) => row.request_id === requestId && row.error_code === "not_pending",
    ),
  ).toHaveLength(1);
  const history = await admin
    .from("verification_history")
    .select("id,reviewer_id", { count: "exact" })
    .eq("request_id", requestId);
  const audit = await admin
    .from("admin_audit_events")
    .select("id,actor_id", { count: "exact" })
    .eq("entity_id", requestId)
    .eq("action", "verified");
  expect(history.error).toBeNull();
  expect(history.count).toBe(1);
  expect(history.data![0].reviewer_id).toBe(chairId);
  expect(audit.error).toBeNull();
  expect(audit.count).toBe(1);
  expect(audit.data![0].actor_id).toBe(chairId);
  const eligibility = await admin
    .from("election_eligibility")
    .select("id", { count: "exact", head: true })
    .eq("user_id", studentId);
  expect(eligibility.error).toBeNull();
  expect(eligibility.count).toBe(0);
});

test("authorized preview handles a complete 250-row batch without long identifier URLs", async ({
  page,
  baseURL,
}) => {
  await login(page, chairEmail);
  const records = Array.from({ length: 250 }, (_, index) => ({
    registrationNumber: `UI-BATCH-${suffix.slice(0, 12).toUpperCase()}-${index}`,
    email: `modernization-preview-${suffix}-${index}@example.test`,
  }));
  const response = await page.request.post("/api/account/roster/preview", {
    headers: { Origin: new URL(baseURL!).origin },
    data: { records },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ records: [] });
});
