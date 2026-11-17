import { test, expect } from "@playwright/test";
import {
  requestRecoveryDelivery,
  recoveryAcknowledgement,
} from "@/lib/recovery-delivery";

test("success, unknown accounts and provider failures have identical public acknowledgements", async () => {
  const success = await requestRecoveryDelivery(async () => ({ error: null }));
  for (const error of [
    { code: "over_email_send_rate_limit", status: 429 },
    { code: "email_address_not_authorized", status: 400 },
    { code: "unexpected_failure", status: 500 },
  ]) {
    const diagnostics: unknown[] = [];
    expect(
      await requestRecoveryDelivery(
        async () => ({ error }),
        (event) => diagnostics.push(event),
      ),
    ).toEqual(success);
    expect(diagnostics).toEqual([
      {
        event: "password_recovery_unavailable",
        source: "supabase_auth",
        ...error,
      },
    ]);
  }
  expect(success).toEqual(recoveryAcknowledgement);
  expect(success.message).toContain("when email delivery is available");
  expect(success.message).toContain("avoid repeated requests");
});

test("email throttling is diagnosed without retrying the provider or exposing credentials", async () => {
  let attempts = 0;
  const diagnostics: unknown[] = [];
  await requestRecoveryDelivery(
    async () => {
      attempts++;
      return {
        error: {
          status: 429,
          code: "over_email_send_rate_limit",
          message: "PRIVATE provider message",
          email: "private@example.test",
          recoveryUrl: "https://private.example/recovery?code=PRIVATE",
          password: "PRIVATE",
          token: "PRIVATE",
        },
      };
    },
    (event) => diagnostics.push(event),
  );
  expect(attempts).toBe(1);
  expect(diagnostics).toEqual([
    {
      event: "password_recovery_unavailable",
      source: "supabase_auth",
      code: "over_email_send_rate_limit",
      status: 429,
    },
  ]);
  expect(JSON.stringify(diagnostics)).not.toContain("PRIVATE");
});

test("unexpected failures and unrecognized provider fields never enter public responses or logs", async () => {
  const diagnostics: unknown[] = [];
  const result = await requestRecoveryDelivery(
    async () => {
      throw new Error("PRIVATE credential-bearing failure");
    },
    (event) => diagnostics.push(event),
  );
  expect(result).toEqual(recoveryAcknowledgement);
  expect(diagnostics).toEqual([
    {
      event: "password_recovery_unavailable",
      source: "application",
      code: "unexpected_error",
      status: 0,
    },
  ]);
  const unknown: unknown[] = [];
  await requestRecoveryDelivery(
    async () => ({
      error: { code: "PRIVATE", status: "PRIVATE", message: "PRIVATE" },
    }),
    (event) => unknown.push(event),
  );
  expect(unknown).toEqual([
    {
      event: "password_recovery_unavailable",
      source: "supabase_auth",
      code: "unknown_auth_error",
      status: 0,
    },
  ]);
});
