import { test, expect } from "@playwright/test";

test("management deployment rejects ballot submission before any account or database work", async ({ request }) => {
  const response = await request.post("/api/account/elections/00000000-0000-4000-8000-000000000001/ballot", {
    data: { selections: [] },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.json()).error).toContain("Real electronic voting is not authorized");
});

test("health endpoint declares the disabled real-voting boundary", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toMatchObject({ status: "ok", realVotingEnabled: false });
});
