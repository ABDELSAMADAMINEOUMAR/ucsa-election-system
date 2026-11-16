import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import {
  readBoundedBody,
  readBoundedJson,
  MAX_JSON_BYTES,
} from "../src/lib/bounded-body";
import { createElectionPdf } from "../src/lib/reports/pdf";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
if (
  !url ||
  !key ||
  !secret ||
  !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(url)
)
  throw new Error("Phase 5 requires the isolated local Supabase stack.");
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const reportTypes = [
  "election-summary",
  "certified-results",
  "candidate-results",
  "participation-summary",
  "complaints-summary",
  "certification-record",
];

test("generated local credential files are ignored and absent from the Git index", () => {
  for (const path of [
    "supabase/.temp/start-secrets/",
    "supabase/local-signing-keys.json",
    ".env.local",
  ]) {
    expect(
      execFileSync("git", ["ls-files", "--", path], {
        encoding: "utf8",
      }).trim(),
      path,
    ).toBe("");
    expect(
      spawnSync("git", ["check-ignore", "--quiet", "--", path]).status,
      path,
    ).toBe(0);
  }
  expect(
    spawnSync("git", ["check-ignore", "--quiet", "--", ".env.example"]).status,
  ).toBe(1);
});

test("private Storage enforces the 5 MiB complaint and 2 MiB candidate limits", async () => {
  const root = `phase5-size-${randomUUID()}`;
  const exact = `${root}/exact.pdf`;
  const oversized = `${root}/oversized.pdf`;
  const photo = `${root}/oversized.png`;
  const bytes = Buffer.alloc(5 * 1024 * 1024 + 1, 32);
  bytes.write("%PDF-1.4\n");
  try {
    expect(
      (
        await admin.storage
          .from("complaint-private")
          .upload(exact, bytes.subarray(0, 5 * 1024 * 1024), {
            contentType: "application/pdf",
          })
      ).error,
    ).toBeNull();
    expect(
      (
        await admin.storage
          .from("complaint-private")
          .upload(oversized, bytes, { contentType: "application/pdf" })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await admin.storage
          .from("candidate-private")
          .upload(photo, bytes.subarray(0, 2 * 1024 * 1024 + 1), {
            contentType: "image/png",
          })
      ).error,
    ).not.toBeNull();
  } finally {
    expect(
      (await admin.storage.from("complaint-private").remove([exact, oversized]))
        .error,
    ).toBeNull();
    expect(
      (await admin.storage.from("candidate-private").remove([photo])).error,
    ).toBeNull();
  }
});

test("stream bounds reject understated lengths and cancel oversized uploads", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: stream,
    headers: { "content-length": "1" },
    duplex: "half",
  } as RequestInit);
  expect(await readBoundedBody(request, 2048)).toBeNull();
  expect(cancelled).toBe(true);
  const valid = new Request("http://localhost/upload", {
    method: "POST",
    body: new Uint8Array([1, 2, 3]),
  });
  expect(await readBoundedBody(valid, 3)).toEqual(new Uint8Array([1, 2, 3]));
});

test("interrupted upload streams fail without partial accepted content", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.error(new Error("Synthetic disconnect"));
    },
  });
  expect(
    await readBoundedBody(
      new Request("http://localhost/upload", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      10,
    ),
  ).toBeNull();
});

test("anonymous JSON endpoints bound actual bytes before authentication work", async ({
  request,
  baseURL,
}) => {
  const payload =
    JSON.stringify({
      email: "phase5-bounded-json@example.test",
      password: "Synthetic-Password-2026!",
    }) + " ".repeat(MAX_JSON_BYTES);
  expect(
    await readBoundedJson(
      new Request("http://localhost/json", { method: "POST", body: payload }),
    ),
  ).toBeNull();
  expect(
    await readBoundedJson(
      new Request("http://localhost/json", { method: "POST", body: "{bad" }),
    ),
  ).toBeNull();
  const response = await request.post("/api/account/sign-in", {
    headers: {
      Origin: new URL(baseURL!).origin,
      "Content-Type": "application/json",
    },
    data: payload,
  });
  expect(response.status()).toBe(400);
});

for (const type of reportTypes) {
  test(`${type} PDF handles empty, Unicode and large synthetic reports`, async () => {
    for (const length of [0, 3, 150]) {
      const bytes = await createElectionPdf(
        type,
        "Élection UCSA — أحمد",
        "SYNTHETIC",
        Array.from({ length }, (_, index) => ({
          text: `Élève أحمد ${index}: 0 votes · 0.00% · Synthetic local QA`,
        })),
      );
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      if (length === 150) expect(pdf.getPageCount()).toBeGreaterThan(2);
    }
  });
}

test("all private report types and mutation endpoints reject anonymous and cross-origin requests", async ({
  request,
  baseURL,
}) => {
  const id = randomUUID();
  for (const type of reportTypes)
    expect(
      (
        await request.get(`/api/account/elections/${id}/reports/${type}`)
      ).status(),
    ).toBe(401);
  for (const path of [
    "roster",
    "committee-members",
    "elections",
    "election-eligibility",
    "applications",
    "complaints",
    `elections/${id}/ballot`,
    `elections/${id}/certification`,
    `complaints/${id}`,
    `complaints/${id}/evidence`,
  ]) {
    const route = `/api/account/${path}`;
    expect(
      (
        await request.post(route, {
          headers: { Origin: "https://attacker.example" },
          data: {},
        })
      ).status(),
      route,
    ).toBe(403);
    expect(
      (
        await request.post(route, {
          headers: { Origin: new URL(baseURL!).origin },
          data: {},
        })
      ).status(),
      route,
    ).toBe(401);
  }
  expect(
    (await request.get(`/api/public/elections/${id}/results.pdf`)).status(),
  ).toBe(404);
});

test("logout and suspension invalidate an old JWT at RLS and RPC boundaries", async () => {
  const email = `phase5-session-${randomUUID()}@example.test`;
  const password = `Phase5-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic session test" },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    expect(
      (
        await admin
          .from("committee_members")
          .insert({ user_id: id, role: "committee_chair" })
      ).error,
    ).toBeNull();
    const client = makeClient();
    const login = await client.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull();
    const oldClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${login.data.session!.access_token}`,
        },
      },
    });
    expect(
      (
        await oldClient.rpc("has_committee_role", {
          allowed: ["committee_chair"],
        })
      ).data,
    ).toBe(true);
    expect(
      (await admin.auth.admin.updateUserById(id, { ban_duration: "1h" })).error,
    ).toBeNull();
    expect(
      (
        await oldClient.rpc("has_committee_role", {
          allowed: ["committee_chair"],
        })
      ).data,
    ).toBe(false);
    expect((await oldClient.from("profiles").select("id")).data).toEqual([]);
    expect(
      (await admin.auth.admin.updateUserById(id, { ban_duration: "none" }))
        .error,
    ).toBeNull();
    expect((await client.auth.signOut()).error).toBeNull();
    expect((await oldClient.rpc("is_active_session")).data).toBe(false);
    expect(
      (
        await oldClient.rpc("has_committee_role", {
          allowed: ["committee_chair"],
        })
      ).data,
    ).toBe(false);
    expect((await oldClient.from("profiles").select("id")).data).toEqual([]);
    expect(
      (
        await oldClient.rpc("submit_verification_request", {
          registration_number_input: "PHASE5-REPLAY",
        })
      ).error,
    ).not.toBeNull();
  } finally {
    expect(
      (await admin.from("committee_members").delete().eq("user_id", id)).error,
    ).toBeNull();
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});

test("certifying officer can see committee entry while an ordinary student cannot", async ({
  page,
}) => {
  const email = `phase6-certifier-${randomUUID()}@example.test`;
  const password = `Phase6-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic Certifier" },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    expect(
      (
        await admin
          .from("committee_members")
          .insert({ user_id: id, role: "certifying_officer" })
      ).error,
    ).toBeNull();
    await page.goto("/account/sign-in");
    await page.getByLabel("Student email").fill(email);
    await page.locator("input[name=password]").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("link", { name: "Open authorized tools" }),
    ).toBeVisible();
    await page.route("**/api/account/sign-out", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Sign out could not be completed. Please try again.",
        }),
      }),
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.locator(".account-header-right").getByRole("alert"),
    ).toContainText("Sign out could not be completed");
    await expect(page).toHaveURL(/\/account$/);
    await page.unroute("**/api/account/sign-out");
    await page.goto("/account/committee");
    await expect(page).toHaveURL(/\/account\/committee$/);
    await page.goto("/account/committee/eligibility");
    await expect(page).toHaveURL(/\/account(?:\/sign-in)?(?:\?|$)/);
    expect(
      (await admin.from("committee_members").delete().eq("user_id", id)).error,
    ).toBeNull();
    await page.goto("/account");
    await expect(
      page.getByRole("link", { name: "Open authorized tools" }),
    ).toHaveCount(0);
    await page.goto("/account/committee");
    await expect(page).toHaveURL(/\/account\/activate$/);
  } finally {
    await admin.from("committee_members").delete().eq("user_id", id);
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});

test("account workspaces pass axe checks and revoked committee membership loses HTTP access", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email = `phase5-ui-${randomUUID()}@example.test`;
  const password = `Phase5-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic Phase 5 Reviewer" },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    expect(
      (
        await admin
          .from("committee_members")
          .insert({ user_id: id, role: "committee_chair" })
      ).error,
    ).toBeNull();
    await page.goto("/account/sign-in");
    await page.getByLabel("Student email").fill(email);
    await page.locator("input[name=password]").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/account$/);
    for (const route of [
      "/account/student",
      "/account/student/applications",
      "/account/student/vote",
      "/account/student/complaints",
      "/account/committee/verification",
      "/account/committee/complaints",
      "/account/committee/certification",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Try again", exact: true }),
      ).toHaveCount(0);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect
        .soft(
          result.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          route,
        )
        .toEqual([]);
    }
    expect(
      (await admin.from("committee_members").delete().eq("user_id", id)).error,
    ).toBeNull();
    expect((await page.request.get("/api/account/roster")).status()).toBe(403);
    await page.goto("/account/committee/certification");
    await expect(page).toHaveURL(/\/account\/activate$/);
  } finally {
    await admin.from("committee_members").delete().eq("user_id", id);
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
