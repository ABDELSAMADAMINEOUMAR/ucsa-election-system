import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import { strToU8, strFromU8, zipSync, unzipSync } from "fflate";
import { registerExcelTemplate } from "../src/lib/official-register-file";
import AxeBuilder from "@axe-core/playwright";
loadEnvConfig(process.cwd());
test("5000-entry XLSX preview is paged, private, responsive and requires chair confirmation", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  test.setTimeout(180000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(url))
    throw new Error("Only the UCSA local stack is allowed.");
  const admin = createClient(url, process.env.SUPABASE_TEST_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tag = randomUUID().slice(0, 8),
    password = `Synthetic-${randomUUID()}!`;
  const reviewer = await admin.auth.admin.createUser({
    email: `volume-reviewer-${tag}@example.test`,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic Register Reviewer" },
  });
  const chair = await admin.auth.admin.createUser({
    email: `volume-chair-${tag}@example.test`,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic Register Chair" },
  });
  expect(reviewer.error).toBeNull();
  expect(chair.error).toBeNull();
  const reviewerId = reviewer.data.user!.id,
    chairId = chair.data.user!.id;
  expect(
    (
      await admin.from("committee_members").insert([
        { user_id: reviewerId, role: "verification_officer" },
        { user_id: chairId, role: "committee_chair" },
      ])
    ).error,
  ).toBeNull();
  const files = unzipSync(registerExcelTemplate());
  const path = "xl/worksheets/sheet1.xml";
  const original = strFromU8(files[path]);
  const header = original.match(/<row r="1">[\s\S]*?<\/row>/)![0];
  const rows = Array.from(
    { length: 5000 },
    (_, i) =>
      `<row r="${i + 2}"><c r="A${i + 2}" t="inlineStr"><is><t>Fictional Volume Student ${i}</t></is></c><c r="B${i + 2}" t="inlineStr"><is><t>VOL-${tag.toUpperCase()}-${i}</t></is></c><c r="C${i + 2}" t="inlineStr"><is><t>volume-${tag}-${i}@example.test</t></is></c></row>`,
  ).join("");
  files[path] = strToU8(
    original.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${header}${rows}</sheetData>`,
    ),
  );
  const bytes = Buffer.from(zipSync(files));
  const chairContext = await browser.newContext();
  try {
    await page.goto("/account/sign-in");
    await page.getByLabel("Student email").fill(reviewer.data.user!.email!);
    await page.locator("input[name=password]").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/account/committee/roster");
    await page.getByLabel("Register title").fill(`Synthetic 5000 XLSX ${tag}`);
    for (const [name, value] of [
      ["Membership registration opens", "2026-01-01T08:00"],
      ["Membership registration closes", "2026-01-02T17:00"],
      ["Account activation opens", "2026-01-03T08:00"],
      ["Account activation closes", "2027-01-01T17:00"],
    ])
      await page.getByLabel(name, { exact: false }).fill(value);
    await page
      .getByLabel("Source approval / change reason")
      .fill(
        "Synthetic 5000-row browser validation; do not approve this fictional source.",
      );
    await page.getByLabel("Official voter file").setInputFiles({
      name: "fictional-5000.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: bytes,
    });
    await page
      .getByRole("button", { name: "Upload and preview", exact: true })
      .click();
    await expect(page.getByText("5000 records", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/5000 valid · 0 invalid/)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Review approval and lock",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.locator("table tbody tr")).toHaveCount(25);
    const staged = await admin
      .from("official_registers")
      .select("id,status")
      .eq("created_by", reviewerId)
      .eq("title", `Synthetic 5000 XLSX ${tag}`)
      .single();
    expect(staged.error).toBeNull();
    expect(staged.data!.status).toBe("staging");
    expect(
      (
        await admin
          .from("official_register_entries")
          .select("identity_id", { count: "exact", head: true })
          .eq("register_id", staged.data!.id)
      ).count,
    ).toBe(0);
    expect(
      (
        await request.get(
          `/api/account/official-register?id=${staged.data!.id}`,
        )
      ).status(),
    ).toBe(401);
    const template = await page.request.get(
      "/api/account/register-template?format=xlsx",
    );
    expect(template.status()).toBe(200);
    const last = await page.request.get(
      `/api/account/official-register?id=${staged.data!.id}&page=200`,
    );
    expect(last.status()).toBe(200);
    expect((await last.json()).rows).toHaveLength(25);
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width <= 390) {
        await expect(
          page.locator("table tbody tr").first().locator("td").first(),
        ).toHaveCSS("display", "grid");
        const mobileAxe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(mobileAxe.violations.map((v) => v.id)).toEqual([]);
      }
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `test-results/official-register/register-${width === 390 ? "mobile" : "desktop"}.png`,
          fullPage: true,
        });
    }
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    const chairPage = await chairContext.newPage();
    await chairPage.goto(`${baseURL}/account/sign-in`);
    await chairPage.getByLabel("Student email").fill(chair.data.user!.email!);
    await chairPage.locator("input[name=password]").fill(password);
    await chairPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(chairPage).toHaveURL(/\/account$/);
    await chairPage.goto(`${baseURL}/account/committee/roster`);
    await chairPage
      .getByRole("button", { name: new RegExp(`Synthetic 5000 XLSX ${tag}`) })
      .click();
    await chairPage
      .getByRole("button", { name: "Review approval and lock", exact: true })
      .click();
    await expect(chairPage.getByRole("dialog")).toContainText("5000 entries");
    await chairPage.keyboard.press("Escape");
    // Full approval atomicity is exercised by rollback-only 5000-row SQL tests.
    // This browser case deliberately leaves this source unapproved.
    const retained = await chairPage.request.get(
      `/api/account/official-register?id=${staged.data!.id}&source=1`,
    );
    expect(retained.status()).toBe(200);
    const raw = await retained.body();
    expect(createHash("sha256").update(raw).digest("hex")).toBe(
      retained.headers()["x-content-sha256"],
    );
    expect(JSON.parse(raw.toString())).toHaveLength(5000);
    const locked = await admin
      .from("official_registers")
      .select("id")
      .eq("status", "locked")
      .like("title", "Synthetic browser fixture %")
      .order("approved_at", { ascending: false })
      .limit(1)
      .single();
    expect(locked.error).toBeNull();
    const lockedSource = await chairPage.request.get(
      `/api/account/official-register?id=${locked.data!.id}&source=1`,
    );
    expect(lockedSource.status()).toBe(200);
    expect(
      createHash("sha256")
        .update(await lockedSource.body())
        .digest("hex"),
    ).toBe(lockedSource.headers()["x-content-sha256"]);

    // Downgrade only this new fictional reviewer through the normal audited API.
    // An election-scoped officer must not see global register upload controls.
    const origin = new URL(baseURL!).origin;
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 16);
    const election = await chairPage.request.post("/api/account/elections", {
      headers: { Origin: origin },
      data: {
        title: `Synthetic scoped register guard ${tag}`,
        description: "Fictional permission-boundary verification only.",
        nominationsStart: day(1),
        nominationsEnd: day(2),
        votingStart: day(3),
        votingEnd: day(4),
        offices: ["President"],
      },
    });
    expect(election.status()).toBe(201);
    const electionId = (await election.json()).id;
    for (const action of ["remove", "add"]) {
      const change = await chairPage.request.post(
        "/api/account/committee-members",
        {
          headers: { Origin: origin },
          data: {
            userId: reviewerId,
            role: "verification_officer",
            electionId: action === "add" ? electionId : null,
            action,
          },
        },
      );
      expect(change.status()).toBe(200);
    }
    await page.goto("/account/committee/roster");
    await expect(page).toHaveURL(/\/account$/);
    expect(
      (
        await page.request.get(
          `/api/account/official-register?id=${staged.data!.id}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/account/official-register", {
          headers: { Origin: origin },
          data: {
            id: staged.data!.id,
            snapshot: "0".repeat(64),
            confirmed: true,
          },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await chairContext.close();
    await admin
      .from("committee_members")
      .delete()
      .in("user_id", [
        reviewerId,
        chairId,
      ]); /* Retain only these new fictional Auth/source/audit rows; no existing data cleanup. */
  }
});
