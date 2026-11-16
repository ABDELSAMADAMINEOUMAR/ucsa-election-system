import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Keep browser evidence for the three previously intermittent demo journeys.
// These routes contain fictional data only; never capture authenticated tokens.
const diagnostics = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }, info) => {
  if (!/application validation|committee approval|report print/.test(info.title)) return;
  const events: string[] = [];
  diagnostics.set(page, events);
  page.on("pageerror", (error) => events.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") events.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => events.push(`failed: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    if (response.status() >= 400) events.push(`http: ${response.status()} ${new URL(response.url()).pathname}`);
  });
});
test.afterEach(async ({ page }, info) => {
  const events = diagnostics.get(page);
  if (events) await info.attach("demo-browser-diagnostics", { body: JSON.stringify(events, null, 2), contentType: "application/json" });
});

const routes = [
  "/",
  "/sign-in",
  "/student",
  "/student/candidates",
  "/student/candidates/candidate-1",
  "/student/apply",
  "/student/application-status",
  "/student/vote",
  "/student/vote/review",
  "/student/vote/success",
  "/student/results",
  "/student/profile",
  "/committee",
  "/committee/voters",
  "/committee/candidates",
  "/committee/candidates/candidate-3",
  "/committee/elections",
  "/committee/controls",
  "/committee/complaints",
  "/committee/results",
  "/committee/reports",
];
async function clientNavigate(page: Page, href: string) {
  // Wait for the destination role's sidebar. An outgoing page may contain a
  // shortcut with the same href while a role-switch transition is pending.
  // Clicking that transient "first visible" link made this journey race.
  const link = page.locator(`.sidebar .side-nav a[href="${href}"]`);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(href);
}

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`all screens render without overflow at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
      }));
      expect(
        overflow.scroll,
        `Horizontal overflow on ${route} at ${width}px`,
      ).toBeLessThanOrEqual(overflow.width);
    }
    expect(errors).toEqual([]);
  });
}

test("welcome entry, demo navigation, password validation and recovery dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Explore the separate fictional demonstration",{exact:true}).click();
  await page.getByRole("link", { name: "Student portal demo", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.getByRole("button", { name: "Preview form validation" }).click();
  await expect(
    page.getByText("Enter your email or registration number."),
  ).toBeVisible();
  await expect(page.getByText("Enter at least 8 characters.")).toBeVisible();
  await page.getByLabel("Email or registration number").fill("DEMO-2026-001");
  await page.getByLabel("Password", { exact: true }).fill("fictional-only");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Preview form validation" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Authentication is not available",
  );
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No reset message is sent",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Enter student demo" }).click();
  await expect(page).toHaveURL("/student");
  await page.getByRole("link", { name: "Committee view" }).click();
  await expect(page).toHaveURL("/committee");
});

test("search and office filters show approved candidates only", async ({
  page,
}) => {
  await page.goto("/student/candidates");
  await expect(page.locator(".candidate-card")).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Filter by office" })
    .selectOption("Treasurer");
  await expect(page.locator(".candidate-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Search candidates…" })
    .fill("no matches");
  await expect(page.getByText("No matches found")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(4);
  await page
    .locator(".candidate-card")
    .first()
    .getByRole("link", { name: "View profile" })
    .click();
  await expect(page.getByRole("heading", { name: "Manifesto" })).toBeVisible();
});

test("application validation, photo selection, committee rejection and student status", async ({
  page,
}) => {
  await page.goto("/student/apply");
  await page.getByRole("button", { name: "Review application" }).click();
  await expect(page.getByText("Write at least 30 characters.")).toBeVisible();
  await expect(page.getByText("Write at least 80 characters.")).toBeVisible();
  await page
    .getByLabel("Biography", { exact: true })
    .fill(
      "A fictional student who values inclusive community leadership and transparent communication.",
    );
  await page
    .getByLabel("Your manifesto", { exact: true })
    .fill(
      "Our community deserves better support. I will create mentorship opportunities, publish regular updates, and work with students to deliver inclusive academic and cultural activities.",
    );
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("fictional"),
  });
  await expect(
    page.getByText("Select a JPEG, PNG, or WebP image smaller than 2 MB."),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "demo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR5kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Review application" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Review your demo application",
  );
  await page
    .getByRole("button", { name: "Complete simulation", exact: true })
    .click();
  await expect(page).toHaveURL("/student/application-status");
  await expect(page.locator("main .avatar img").first()).toHaveJSProperty("naturalWidth", 1);
  await expect(
    page.locator("main").getByText("Awaiting committee review"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Committee view" }).click();
  await clientNavigate(page, "/committee/candidates");
  await page
    .getByRole("textbox", { name: "Search candidates…" })
    .fill("Mariam");
  await page
    .locator(".candidate-card")
    .getByRole("link", { name: "Review" })
    .click();
  await page.getByRole("button", { name: "Reject with reason" }).click();
  await expect(
    page.getByRole("button", { name: "Reject simulation", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Reason for rejection" })
    .fill(
      "This is a fictional review explanation for testing the status journey.",
    );
  await page
    .getByRole("button", { name: "Reject simulation", exact: true })
    .click();
  await expect(
    page.locator(".profile-summary").getByText("Rejected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Student view" }).click();
  await page.getByRole("link", { name: "Track your application" }).click();
  await expect(
    page
      .getByRole("main")
      .getByText(
        "This is a fictional review explanation for testing the status journey.",
      ),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("No demo application yet")).toBeVisible();
});

test("ballot review confirms no storage, no network submission, no result mutation, and clears selections", async ({
  page,
}) => {
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
      submissions.push(request.url());
  });
  await page.goto("/student/vote");
  await page.getByRole("button", { name: "Review my demo ballot" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Choose one approved",
  );
  for (const group of await page.getByRole("group").all())
    await group.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Review my demo ballot" }).click();
  await expect(page).toHaveURL("/student/vote/review");
  await expect(
    page.locator(".review-selections").getByText("Amina Mahamat"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish UI simulation" }).click();
  await expect(page).toHaveURL("/student/vote/success");
  await expect(
    page.getByText("No real vote was submitted.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      session: { ...sessionStorage },
    })),
  ).toEqual({ local: {}, session: {} });
  await page.getByRole("link", { name: "Try the demo again" }).click();
  await expect(page.locator("input:checked")).toHaveCount(0);
  await clientNavigate(page, "/student/results");
  await expect(page.getByText("110 sample votes")).toHaveCount(3);
  expect(submissions).toEqual([]);
  await page.goto("/student/vote");
  await page.getByRole("radio").first().check();
  await page.reload();
  await expect(page.locator("input:checked")).toHaveCount(0);
});

test("voter decisions and complaint resolutions update local state", async ({
  page,
}) => {
  await page.goto("/committee/voters");
  await page
    .getByRole("combobox", { name: "Verification status" })
    .selectOption("Pending");
  await expect(page.locator(".table-row")).toHaveCount(2);
  await page.locator(".table-row").first().getByRole("button").click();
  await page.getByRole("button", { name: "Verify demo student" }).click();
  await page.getByRole("button", { name: "Confirm demo verification" }).click();
  await expect(page.getByRole("dialog")).toContainText("Verified");
  await page.keyboard.press("Escape");
  await expect(page.locator(".table-row")).toHaveCount(1);
  await clientNavigate(page, "/committee/complaints");
  await page.getByRole("button", { name: "View case CMP-001" }).click();
  await page.getByRole("button", { name: "Mark under review" }).click();
  await expect(page.getByRole("dialog")).toContainText("Under review");
  await page
    .getByRole("textbox", { name: "Resolution notes" })
    .fill(
      "The fictional registration has been checked and corrected for this demo.",
    );
  await page.getByRole("button", { name: "Resolve demo case" }).click();
  await page.getByRole("button", { name: "Confirm demo resolution" }).click();
  await expect(page.getByRole("dialog")).toContainText("Demo resolution");
});

test("committee approval makes a fictional candidate available in the student directory", async ({
  page,
}) => {
  await page.goto("/committee/candidates/candidate-3");
  await page
    .getByRole("button", { name: "Approve simulation", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve simulation", exact: true })
    .click();
  await expect(
    page
      .locator(".profile-summary:visible")
      .getByText("Approved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Student view" }).click();
  await clientNavigate(page, "/student/candidates");
  await page.getByRole("textbox", { name: "Search candidates…" }).fill("Grace");
  await expect(page.locator(".candidate-card:visible")).toHaveCount(1);
  await expect(page.locator(".candidate-card:visible")).toContainText(
    "Grace Djamal",
  );
  await page.reload();
  await page.getByRole("textbox", { name: "Search candidates…" }).fill("Grace");
  await expect(page.locator(".candidate-card:visible")).toHaveCount(0);
});

test("setup validation, lifecycle, hidden totals, certification checklist, and reset", async ({
  page,
}) => {
  await page.goto("/committee/elections");
  await page
    .getByLabel("Voting ends", { exact: true })
    .fill("2026-11-19T18:00");
  await page.getByRole("button", { name: "Save demo configuration" }).click();
  await expect(
    page.getByText("Voting must end after it starts."),
  ).toBeVisible();
  await page
    .getByLabel("Voting ends", { exact: true })
    .fill("2026-11-20T18:00");
  await page
    .getByLabel("Election title", { exact: true })
    .fill("Fictional Election QA Preview");
  await page.getByRole("button", { name: "Save demo configuration" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Demo election configuration saved." })).toContainText(
    "Demo election configuration saved.",
  );
  await clientNavigate(page, "/committee/results");
  await expect(
    page.getByText("Candidate totals are hidden in this stage."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore election controls" }).click();
  for (const stage of ["prepared", "open", "closed", "pending certification"]) {
    await page.getByRole("button", { name: `Preview ${stage} stage` }).click();
    await page.getByRole("button", { name: "Confirm demo transition" }).click();
    if (stage === "open") {
      await clientNavigate(page, "/committee/results");
      await expect(
        page.getByText("Candidate totals are hidden in this stage."),
      ).toBeVisible();
      await expect(page.getByText("110 sample votes")).toHaveCount(0);
      await page
        .getByRole("link", { name: "Explore election controls" })
        .click();
    }
  }
  await page.getByRole("link", { name: "Open certification preview" }).click();
  await expect(
    page.getByRole("button", { name: "Preview demo certification" }),
  ).toBeDisabled();
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.check();
  await page
    .getByRole("button", { name: "Preview demo certification" })
    .click();
  await page
    .getByRole("button", { name: "Complete demo certification" })
    .click();
  await expect(
    page.getByText(
      "Demo certification preview completed. No official result was created.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(
    page.getByText("Candidate totals are hidden in this stage."),
  ).toBeVisible();
});

test("keyboard menu is focus-trapped, escape returns focus, and mobile navigation works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/committee");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Voter verification" })
    .click();
  await expect(page).toHaveURL("/committee/voters");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("core pages have no WCAG A/AA axe violations", async ({ page }) => {
  test.setTimeout(180_000);
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    // Dynamic candidate pages can start their entrance animation after the
    // heading is visible. Measure settled text, without excluding axe rules.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)));
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect
      .soft(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        `Accessibility findings on ${route}`,
      )
      .toEqual([]);
  }
});

test("not-found, report print layout, and visual review artifacts", async ({
  page,
}) => {
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "A different path awaits." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to welcome" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/welcome-desktop.png",
    fullPage: true,
  });
  await page.goto("/committee");
  await page.screenshot({
    path: "test-results/committee-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/student");
  await page.screenshot({
    path: "test-results/student-mobile.png",
    fullPage: true,
  });
  await page.goto("/committee/reports");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".app-header")).toBeHidden();
  await expect(page.locator(".workspace")).toHaveCSS("margin-left", "0px");
  await expect(
    page.getByText("Demonstration report — fictional data only."),
  ).toBeVisible();
  await page.pdf({ path: "test-results/demo-report.pdf", format: "A4" });
});
