import { boundFixture, retainFixtureAuth } from "./official-fixtures";
import { test, expect, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

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
  throw new Error(
    "Nomination tests require this project's isolated local stack.",
  );
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function checked(result: { error: unknown }) {
  expect(result.error).toBeNull();
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/account/sign-in");
  await page.getByLabel("Student email").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
}

for (const failure of [
  "submit failure and resumed edits",
  "submit failure and same-page retry",
  "upload failure",
  "lost creation response",
  "lost upload response",
  "lost submission response",
] as const) {
  test(`nomination lifecycle: ${failure}`, async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const tag = randomUUID();
    const password = `Synthetic-${randomUUID()}!`;
    const student = randomUUID();
    const chair = randomUUID();
    const election = randomUUID();
    const office = randomUUID();
    const requestId = randomUUID();
    const studentEmail = `nomination-${tag}@example.test`;
    const chairEmail = `nomination-chair-${tag}@example.test`;
    const name = `Synthetic Nominee ${tag}`;
    const registration = `N-${tag.slice(0, 24).toUpperCase()}`;
    const biography =
      "Edited biography: a fictional nominee working for student wellbeing and transparent leadership.";
    const manifesto =
      "Edited manifesto: this fictional candidate will publish clear updates, support mentorship and represent students fairly throughout the association's activities.";
    let applicationId: string | undefined;
    let photoRequests = 0;
    const photo = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    const reviewerContext = await browser.newContext();
    try {
      for (const [id, email, fullName] of [
        [student, studentEmail, name],
        [chair, chairEmail, "Synthetic nomination reviewer"],
      ]) {
        await checked(
          await admin.auth.admin.createUser({
            id,
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          }),
        );
      }
      await checked(
        await admin
          .from("committee_members")
          .insert({ user_id: chair, role: "committee_chair" }),
      );
      await checked(
        await admin
          .from("eligible_students")
          .insert({
            registration_number: registration,
            verified_email: studentEmail,
          }),
      );
      await checked(
        await admin
          .from("student_verification_requests")
          .insert({
            id: requestId,
            user_id: student,
            requested_registration_number: registration,
          }),
      );
      const reviewer = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await checked(
        await reviewer.auth.signInWithPassword({ email: chairEmail, password }),
      );
      await checked(
        await reviewer.rpc("decide_student_verification", {
          request_id_input: requestId,
          decision_input: "verified",
          reason_input: "Fictional test roster",
        }),
      );
      const now = Date.now();
      await checked(
        await admin
          .from("elections")
          .insert({
            id: election,
            title: `Synthetic nomination ${tag}`,
            created_by: chair,
            nominations_start: new Date(now - 86400000).toISOString(),
            nominations_end: new Date(now + 86400000).toISOString(),
            voting_start: new Date(now + 172800000).toISOString(),
            voting_end: new Date(now + 259200000).toISOString(),
            status: "draft",
          }),
      );
      await checked(
        await admin
          .from("election_offices")
          .insert({
            id: office,
            election_id: election,
            title: "Synthetic President",
            display_order: 0,
          }),
      );
      await checked(
        await admin
          .from("election_eligibility")
          .insert({
            election_id: election,
            user_id: student,
            status: "verified",
            decided_by: chair,
            decided_at: new Date().toISOString(),
          }),
      );
      await boundFixture(admin, [student], [election]);
      const nominee = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await checked(
        await nominee.auth.signInWithPassword({
          email: studentEmail,
          password,
        }),
      );
      const readableElections = await nominee
        .from("elections")
        .select(
          "id,title,status,nominations_start,nominations_end,election_offices!election_offices_election_id_fkey(id,title)",
        )
        .in("status", ["draft", "prepared"]);
      expect(readableElections.error).toBeNull();
      expect(readableElections.data?.some((item) => item.id === election)).toBe(
        true,
      );
      await login(page, studentEmail, password);
      // Account home redirects students; wait for it before starting navigation.
      await expect(page).toHaveURL(/\/account\/student$/);
      await page.goto("/account/student/applications");
      await page
        .getByRole("combobox", { name: "Election", exact: true })
        .selectOption(election);
      await page
        .getByRole("combobox", { name: "Position", exact: true })
        .selectOption(office);
      await page
        .getByRole("textbox", { name: /^Relevant experience/ })
        .fill(
          "Initial fictional biography with enough characters to create a draft.",
        );
      await page
        .getByRole("textbox", { name: /^Motivation and plans/ })
        .fill(
          "Initial fictional manifesto with enough detail for a complete nomination. We support transparent representation and better student communication.",
        );
      await page
        .getByLabel("Candidate photo (optional)")
        .setInputFiles({
          name: "synthetic.png",
          mimeType: "image/png",
          buffer: photo,
        });
      await page.getByRole("checkbox").check();
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          /\/photo$/.test(new URL(request.url()).pathname)
        )
          photoRequests++;
      });
      const failurePath =
        failure === "lost creation response"
          ? "**/api/account/applications"
          : failure === "lost upload response" || failure === "upload failure"
            ? "**/api/account/applications/*/photo"
            : "**/api/account/applications/*/submit";
      await page.route(
        failurePath,
        async (route) => {
          if (
            failure.startsWith("submit failure") ||
            failure === "upload failure"
          )
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Synthetic submission outage" }),
            });
          else {
            await route.fetch();
            await route.abort("failed");
          }
        },
        { times: 1 },
      );
      await page
        .getByRole("button", { name: "Submit application for review" })
        .click();
      if (failure !== "lost submission response") {
        await expect(page.locator("main .field-error")).toBeVisible();
        if (failure === "submit failure and resumed edits") {
          const draft = await admin
            .from("candidate_applications")
            .select("id")
            .eq("election_id", election)
            .single();
          expect(draft.error).toBeNull();
          const differentPhoto = await sharp({
            create: { width: 4, height: 4, channels: 3, background: "red" },
          })
            .png()
            .toBuffer();
          const replacement = await page.request.post(
            `/api/account/applications/${draft.data!.id}/photo`,
            {
              headers: { Origin: new URL(baseURL!).origin },
              multipart: {
                photo: {
                  name: "different.png",
                  mimeType: "image/png",
                  buffer: differentPhoto,
                },
              },
            },
          );
          expect(replacement.status()).toBe(409);
          // Resume from the database, rather than relying on component memory.
          await page.reload();
          await expect(
            page.getByRole("textbox", { name: /^Relevant experience/ }),
          ).toHaveValue(/Initial fictional biography/);
        }
        await page
          .getByRole("textbox", { name: /^Relevant experience/ })
          .fill(biography);
        await page
          .getByRole("textbox", { name: /^Motivation and plans/ })
          .fill(manifesto);
        await expect(
          page.getByRole("textbox", { name: /^Relevant experience/ }),
        ).toHaveValue(biography);
        await expect(
          page.getByRole("textbox", { name: /^Motivation and plans/ }),
        ).toHaveValue(manifesto);
        await page.getByRole("checkbox").check();
        await page
          .getByRole("button", { name: "Submit application for review" })
          .click();
      }
      await expect(
        page.getByText(
          "Application submitted for committee review. It is not automatically approved.",
        ),
      ).toBeVisible();
      const applications = await admin
        .from("candidate_applications")
        .select("id,status,biography,manifesto")
        .eq("election_id", election)
        .eq("user_id", student);
      await checked(applications);
      expect(applications.data).toHaveLength(1);
      const application = applications.data![0];
      applicationId = application.id;
      expect(application.status).toBe("submitted");
      if (failure !== "lost submission response") {
        expect(application.biography).toBe(biography);
        expect(application.manifesto).toBe(manifesto);
      }
      const documents = await admin
        .from("candidate_application_documents")
        .select("id,storage_path,mime_type")
        .eq("application_id", application.id);
      await checked(documents);
      expect(documents.data).toHaveLength(1);
      expect(documents.data![0].mime_type).toBe("image/webp");
      expect(photoRequests).toBe(
        failure === "lost upload response" || failure === "upload failure"
          ? 2
          : 1,
      );
      const patch = await page.request.patch(
        `/api/account/applications/${application.id}`,
        {
          headers: { Origin: new URL(baseURL!).origin },
          data: { biography, manifesto, consent: true },
        },
      );
      expect(patch.status()).toBe(409);
      const anonymousPhoto = await page.request.get(
        `${url}/storage/v1/object/public/candidate-private/${documents.data![0].storage_path}`,
      );
      expect(anonymousPhoto.ok()).toBe(false);
      const reviewerPage = await reviewerContext.newPage();
      await login(reviewerPage, chairEmail, password);
      await reviewerPage.goto("/account/committee/candidates");
      const card = reviewerPage.getByRole("row").filter({ hasText: name });
      await card.getByText("View application", { exact: true }).click();
      await expect(card).toContainText(application.biography);
      await expect(
        card.getByRole("img", {
          name: `Private candidate portrait for ${name}`,
          exact: true,
        }),
      ).toHaveJSProperty("naturalWidth", 4);
      await card
        .getByRole("button", { name: "Approve application", exact: true })
        .click();
      await expect(
        card.locator(".badge").filter({ hasText: /^approved$/ }),
      ).toBeVisible();
      expect(
        (
          await admin
            .from("candidate_applications")
            .select("status")
            .eq("id", application.id)
            .single()
        ).data?.status,
      ).toBe("approved");
    } finally {
      await reviewerContext.close();
      // Cleanup is restricted to UUIDs created by this test; no database reset.
      const ownApplications = await admin
        .from("candidate_applications")
        .select("id")
        .eq("election_id", election);
      for (const item of ownApplications.data ?? []) {
        const docs = await admin
          .from("candidate_application_documents")
          .select("storage_path")
          .eq("application_id", item.id);
        if (docs.data?.length)
          await admin.storage
            .from("candidate-private")
            .remove(docs.data.map((doc) => doc.storage_path));
        await admin
          .from("candidate_review_decisions")
          .delete()
          .eq("application_id", item.id);
      }
      await admin
        .from("candidate_applications")
        .delete()
        .eq("election_id", election);
      await admin
        .from("election_eligibility")
        .delete()
        .eq("election_id", election);
      await admin.from("election_offices").delete().eq("election_id", election);
      await admin.from("elections").delete().eq("id", election);
      await admin
        .from("admin_audit_events")
        .delete()
        .in("actor_id", [student, chair]);
      if (applicationId)
        await admin
          .from("admin_audit_events")
          .delete()
          .eq("entity_id", applicationId);
      await admin.from("verification_history").delete().eq("user_id", student);
      await admin
        .from("student_verification_requests")
        .delete()
        .eq("id", requestId);
      await admin
        .from("eligible_students")
        .delete()
        .eq("verified_email", studentEmail);
      await admin.from("committee_members").delete().eq("user_id", chair);
      for (const id of [student, chair])
        await checked(await retainFixtureAuth(id));
    }
  });
}
