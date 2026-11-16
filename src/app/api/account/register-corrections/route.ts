import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { requireApiUser, errorResponse, sameOrigin } from "@/lib/supabase/http";
const correction = z.object({
  action: z.literal("correct"),
  registerId: z.uuid(),
  registrationNumber: z.string().regex(/^[A-Z0-9/-]{3,40}$/),
  fullName: z.string().trim().min(3).max(120),
  email: z.email().max(254),
  newRegistration: z.string().regex(/^[A-Z0-9/-]{3,40}$/),
  reason: z.string().trim().min(10).max(1000),
});
const suspension = z.object({
  action: z.literal("suspend"),
  registrationNumber: z.string().regex(/^[A-Z0-9/-]{3,40}$/),
  status: z.enum(["suspended", "revoked"]),
  reason: z.string().trim().min(10).max(1000),
});
const membership = z.object({
  action: z.enum(["add", "withdraw", "reinstate"]),
  registerId: z.uuid(),
  registrationNumber: z.string().regex(/^[A-Z0-9/-]{3,40}$/),
  fullName: z.string().max(120).default(""),
  email: z.string().max(254).default(""),
  reason: z.string().trim().min(10).max(1000),
});
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const parsed = z
    .discriminatedUnion("action", [correction, suspension, membership])
    .safeParse(await readBoundedJson(request));
  if (!parsed.success)
    return errorResponse(
      400,
      "Check the details and provide a documented reason.",
    );
  const p = parsed.data;
  const result =
    p.action === "correct"
      ? await auth.session.client.rpc("propose_register_correction", {
          register_input: p.registerId,
          registration_input: p.registrationNumber,
          name_input: p.fullName,
          email_input: p.email,
          new_registration_input: p.newRegistration,
          reason_input: p.reason,
        })
      : p.action === "suspend"
        ? await auth.session.client.rpc("suspend_official_voter", {
            registration_input: p.registrationNumber,
            status_input: p.status,
            reason_input: p.reason,
          })
        : await auth.session.client.rpc("propose_membership_change", {
            register_input: p.registerId,
            registration_input: p.registrationNumber,
            name_input: p.fullName,
            email_input: p.email,
            action_input: p.action,
            reason_input: p.reason,
          });
  if (result.error)
    return errorResponse(
      409,
      "The operation could not complete. Check authorization, active election restrictions, and review requirements.",
    );
  return NextResponse.json({ recorded: true, proposalId: result.data });
}
