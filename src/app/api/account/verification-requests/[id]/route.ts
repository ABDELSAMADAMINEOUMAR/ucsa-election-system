import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reviewSchema } from "@/lib/schemas/account";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/verification-requests/[id]">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse(400, "Invalid request.");
  const parsed = reviewSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Choose a valid decision and provide a reason if required.");
  const { error } = await auth.session.client.rpc("decide_student_verification", {
    request_id_input: id,
    decision_input: parsed.data.decision,
    reason_input: parsed.data.reason,
  });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "You are not authorized to review student verification.") : errorResponse(409, "This verification request could not be updated.");
  return NextResponse.json({ ok: true });
}
