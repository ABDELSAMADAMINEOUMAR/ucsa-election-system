export const recoveryAcknowledgement = {
  message:
    "If an account exists for this address, recovery instructions will be sent when email delivery is available. Check your inbox and spam folder. Delivery may be temporarily limited; avoid repeated requests and contact UCSA support if no email arrives. Open the newest link in the same browser where you requested it.",
};

type Diagnostic = {
  event: "password_recovery_unavailable";
  source: "supabase_auth" | "application";
  code: string;
  status: number;
};

const knownCodes = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "email_address_not_authorized",
  "email_address_invalid",
  "unexpected_failure",
  "request_timeout",
]);

/** A delivery failure must not reveal whether the requested email is registered. */
export async function requestRecoveryDelivery(
  send: () => Promise<{ error: unknown }>,
  report: (diagnostic: Diagnostic) => void = (diagnostic) =>
    console.warn(JSON.stringify(diagnostic)),
) {
  try {
    const { error } = await send();
    if (error) {
      const detail = error as { code?: unknown; status?: unknown };
      report({
        event: "password_recovery_unavailable",
        source: "supabase_auth",
        code:
          typeof detail.code === "string" && knownCodes.has(detail.code)
            ? detail.code
            : "unknown_auth_error",
        status:
          typeof detail.status === "number" &&
          Number.isInteger(detail.status) &&
          detail.status >= 400 &&
          detail.status <= 599
            ? detail.status
            : 0,
      });
    }
  } catch {
    // Never log the raw exception, email address, credentials, or recovery URL.
    report({
      event: "password_recovery_unavailable",
      source: "application",
      code: "unexpected_error",
      status: 0,
    });
  }
  return recoveryAcknowledgement;
}
