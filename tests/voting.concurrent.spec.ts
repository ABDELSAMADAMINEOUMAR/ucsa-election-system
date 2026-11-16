import { boundFixture, retainFixtureAuth } from "./official-fixtures";
import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
if (
  !url ||
  !publishableKey ||
  !secretKey ||
  !/^http:\/\/(localhost|127\.0\.0\.1):55021$/.test(url)
) {
  throw new Error(
    "Voting concurrency integration requires the disposable local Supabase stack.",
  );
}
const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const password = `UCSA-${randomUUID()}!`;

async function checked(result: {
  data: unknown;
  error: { message: string } | null;
}): Promise<void> {
  if (result.error)
    throw new Error(
      `Local voting test fixture setup failed: ${result.error.message}`,
    );
}

for (const scenario of [
  "concurrent devices and tabs",
  "interrupted committed response",
  "confirmed commit with unavailable status reload",
] as const)
  test(`${scenario}: one ballot, safe replay and reconciled state`, async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const suffix = randomUUID();
    const electionId = randomUUID();
    const officeId = randomUUID();
    const candidateId = randomUUID();
    const reviewerId = randomUUID();
    const voterId = randomUUID();
    const candidateUserId = randomUUID();
    const requestId = randomUUID();
    const privatePhotoPath = `${candidateUserId}/${candidateId}/phase5-private.png`;
    const reviewerEmail = `phase3-reviewer-${suffix}@example.test`;
    const voterEmail = `phase3-voter-${suffix}@example.test`;
    const candidateEmail = `phase3-candidate-${suffix}@example.test`;
    const registrationNumber = `P3-${suffix.slice(0, 24).toUpperCase()}`;
    try {
      for (const [id, email, name] of [
        [reviewerId, reviewerEmail, "Phase 3 local reviewer"],
        [voterId, voterEmail, "Phase 3 local voter"],
        [candidateUserId, candidateEmail, "Phase 3 local candidate"],
      ]) {
        await checked(
          await admin.auth.admin.createUser({
            id,
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name },
          }),
        );
      }
      await checked(
        await admin.from("committee_members").insert({
          user_id: reviewerId,
          role: "committee_chair",
          election_id: null,
        }),
      );
      await checked(
        await admin.from("eligible_students").insert({
          registration_number: registrationNumber,
          verified_email: voterEmail,
        }),
      );
      await checked(
        await admin.from("student_verification_requests").insert({
          id: requestId,
          user_id: voterId,
          requested_registration_number: registrationNumber,
        }),
      );
      const rosterMatch = await admin
        .from("eligible_students")
        .select("id")
        .eq("registration_number", registrationNumber)
        .eq("verified_email", voterEmail)
        .maybeSingle();
      expect(rosterMatch.data).not.toBeNull();
      const profileMatch = await admin
        .from("profiles")
        .select("id,email")
        .eq("id", voterId)
        .maybeSingle();
      expect(profileMatch.data?.email).toBe(voterEmail.toLowerCase());
      const reviewerAuth = createClient(url, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const reviewerLogin = await reviewerAuth.auth.signInWithPassword({
        email: reviewerEmail,
        password,
      });
      if (reviewerLogin.error)
        throw new Error("Synthetic committee account could not authenticate.");
      await checked(
        await reviewerAuth.rpc("decide_student_verification", {
          request_id_input: requestId,
          decision_input: "verified",
          reason_input: "Synthetic local test identity",
        }),
      );

      const now = Date.now();
      await checked(
        await admin.from("elections").insert({
          id: electionId,
          title: "Synthetic concurrent ballot",
          description: "Disposable local test only",
          created_by: reviewerId,
          nominations_start: new Date(now - 4 * 86400000).toISOString(),
          nominations_end: new Date(now - 3 * 86400000).toISOString(),
          voting_start: new Date(now - 60000).toISOString(),
          voting_end: new Date(now + 3600000).toISOString(),
          status: "prepared",
        }),
      );
      await checked(
        await admin.from("election_offices").insert({
          id: officeId,
          election_id: electionId,
          title: "Synthetic office",
          display_order: 0,
          is_active: true,
        }),
      );
      await checked(
        await admin.from("candidate_applications").insert({
          id: candidateId,
          election_id: electionId,
          office_id: officeId,
          user_id: candidateUserId,
          biography: "Synthetic candidate biography with sufficient length.",
          manifesto:
            "Synthetic candidate manifesto for a disposable integration test, with sufficient length for local verification.",
          status: "approved",
          submitted_at: new Date().toISOString(),
        }),
      );
      await checked(
        await admin.from("election_eligibility").insert(
          [voterId, candidateUserId].map((userId) => ({
            election_id: electionId,
            user_id: userId,
            status: "verified",
            decided_by: reviewerId,
            decided_at: new Date().toISOString(),
          })),
        ),
      );
      await checked(
        await admin
          .from("elections")
          .update({ status: "open" })
          .eq("id", electionId),
      );

      await boundFixture(admin, [voterId, candidateUserId], [electionId]);
      const voterAuth = createClient(url, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const voterLogin = await voterAuth.auth.signInWithPassword({
        email: voterEmail,
        password,
      });
      if (voterLogin.error)
        throw new Error("Synthetic student account could not authenticate.");
      const token = voterLogin.data.session?.access_token;
      expect(token).toBeTruthy();
      if (scenario === "concurrent devices and tabs") {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6X0AAAAASUVORK5CYII=",
          "base64",
        );
        await checked(
          await admin.storage
            .from("candidate-private")
            .upload(privatePhotoPath, png, { contentType: "image/png" }),
        );
        expect(
          (
            await voterAuth.storage
              .from("candidate-private")
              .download(privatePhotoPath)
          ).error,
        ).not.toBeNull();
        const candidateAuth = createClient(url, publishableKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        expect(
          (
            await candidateAuth.auth.signInWithPassword({
              email: candidateEmail,
              password,
            })
          ).error,
        ).toBeNull();
        expect(
          (
            await candidateAuth.storage
              .from("candidate-private")
              .download(privatePhotoPath)
          ).error,
        ).toBeNull();
        // Storage may acknowledge a denied DELETE with an empty result; verify
        // the persisted object rather than assuming a particular HTTP error.
        await candidateAuth.storage
          .from("candidate-private")
          .remove([privatePhotoPath]);
        expect(
          (
            await admin.storage
              .from("candidate-private")
              .download(privatePhotoPath)
          ).error,
        ).toBeNull();
      }
      // Independent client instances model two browsers/devices sharing one student session/account.
      const devices: SupabaseClient[] = Array.from(
        { length: 12 },
        (_, index) => index,
      ).map(() =>
        createClient(url, publishableKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      const page = await context.newPage();
      await page.goto("/account/sign-in");
      await page.getByLabel("Student email").fill(voterEmail);
      await page.locator("input[name=password]").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/account(?:\/student|\/activate)?$/);
      if (scenario === "concurrent devices and tabs") {
        const otherTab = await context.newPage();
        await otherTab.goto("/account/student");
        const started = Date.now();
        const results = await Promise.all([
          ...devices.map(async (device) => {
            const result = await device.rpc("submit_election_ballot", {
              election_id_input: electionId,
              selections_input: [
                { office_id: officeId, candidate_application_id: candidateId },
              ],
            });
            return { error: Boolean(result.error) };
          }),
          ...[page, otherTab].map((tab) =>
            tab.evaluate(
              async ({ electionId, officeId, candidateId }) => {
                const response = await fetch(
                  `/api/account/elections/${electionId}/ballot`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      selections: [{ officeId, candidateId }],
                    }),
                  },
                );
                return { error: !response.ok };
              },
              { electionId, officeId, candidateId },
            ),
          ),
        ]);
        console.log(
          `Bounded local race: 14 requests completed in ${Date.now() - started}ms`,
        );
        expect(results.filter((result) => !result.error)).toHaveLength(1);
        expect(results.filter((result) => result.error)).toHaveLength(13);
      } else {
        await page.goto(`/account/student/vote/${electionId}`);
        await expect(page.getByRole("radio")).toBeVisible();
        for (const width of [320, 375, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
            `ballot overflow at ${width}px`,
          ).toBe(true);
        }
        await page.getByRole("radio").check();
        await page.getByRole("button", { name: "Review selections" }).click();
        await page.route(
          `**/api/account/elections/${electionId}/ballot`,
          async (route) => {
            if (route.request().method() !== "POST") {
              return scenario ===
                "confirmed commit with unavailable status reload"
                ? route.abort("failed")
                : route.continue();
            }
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            expect(response.headers()["cache-control"]).toContain("no-store");
            expect(await response.json()).toEqual({
              recorded: true,
              message: "Your ballot submission was recorded.",
            });
            if (scenario === "interrupted committed response") {
              await route.abort("failed"); // Lose the response AFTER the real database commit.
            } else {
              await route.fulfill({ response });
            }
          },
        );
        await page
          .getByRole("button", { name: "Confirm and submit ballot" })
          .click();
        await expect(
          page.getByRole("heading", { name: "Submission recorded" }),
        ).toBeVisible();
        await expect(page.getByRole("radio")).toHaveCount(0);
        await expect(page.getByText("Selected:", { exact: false })).toHaveCount(
          0,
        );
        await expect(
          page.getByRole("button", { name: "Confirm and submit ballot" }),
        ).toHaveCount(0);
        const persisted = await page.evaluate(() =>
          JSON.stringify([
            Object.entries(localStorage),
            Object.entries(sessionStorage),
          ]),
        );
        expect(persisted).not.toContain(candidateId);
        expect(persisted).not.toContain(officeId);
        await expect(
          page.getByText(
            "A ballot has already been recorded for this office.",
            { exact: false },
          ),
        ).toBeVisible();
      }

      const participationResult = await admin
        .from("vote_participation")
        .select("user_id,office_id")
        .eq("election_id", electionId);
      if (participationResult.error)
        throw new Error("Local participation check failed.");
      const participation = participationResult.data;
      expect(participation).toEqual([
        { user_id: voterId, office_id: officeId },
      ]);
      const ballotsResult = await admin
        .from("anonymous_ballots")
        .select("ballot_id,election_id,office_id,candidate_application_id")
        .eq("election_id", electionId);
      if (ballotsResult.error)
        throw new Error("Local anonymous ballot check failed.");
      const ballots = ballotsResult.data;
      expect(ballots).toHaveLength(1);
      expect(ballots[0]).not.toHaveProperty("user_id");
      const retry = await devices[0].rpc("submit_election_ballot", {
        election_id_input: electionId,
        selections_input: [
          { office_id: officeId, candidate_application_id: candidateId },
        ],
      });
      expect(retry.error).not.toBeNull();
      expect(
        await devices[0].rpc("get_my_vote_status", {
          election_id_input: electionId,
        }),
      ).toMatchObject({ data: [{ office_id: officeId }] });
    } finally {
      await context.close();
      await checked(
        await admin.storage
          .from("candidate-private")
          .remove([privatePhotoPath]),
      );
      // Only this test's isolated election is returned to fixture setup state.
      await checked(
        await admin
          .from("elections")
          .update({ status: "prepared" })
          .eq("id", electionId),
      );
      await admin
        .from("anonymous_ballots")
        .delete()
        .eq("election_id", electionId);
      await admin
        .from("vote_participation")
        .delete()
        .eq("election_id", electionId);
      await admin
        .from("election_eligibility")
        .delete()
        .eq("election_id", electionId);
      await admin
        .from("candidate_applications")
        .delete()
        .eq("election_id", electionId);
      await admin
        .from("election_offices")
        .delete()
        .eq("election_id", electionId);
      await admin
        .from("admin_audit_events")
        .delete()
        .eq("actor_id", reviewerId);
      await admin
        .from("admin_audit_events")
        .delete()
        .eq("entity_id", requestId);
      await admin.from("elections").delete().eq("id", electionId);
      await admin.from("verification_history").delete().eq("user_id", voterId);
      await admin
        .from("student_verification_requests")
        .delete()
        .eq("user_id", voterId);
      await admin
        .from("eligible_students")
        .delete()
        .eq("verified_email", voterEmail);
      await admin
        .from("committee_members")
        .delete()
        .in("user_id", [reviewerId]);
      for (const id of [reviewerId, voterId, candidateUserId])
        await checked(await retainFixtureAuth(id));
    }
  });
