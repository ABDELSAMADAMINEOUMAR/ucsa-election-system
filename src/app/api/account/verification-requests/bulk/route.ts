import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/bounded-body";
import { bulkDecisionSchema } from "@/lib/schemas/bulk";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const parsed = bulkDecisionSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Select up to 100 unique requests and confirm the decision. Rejection requires a reason.");
  const { data, error } = await auth.session.client.rpc("bulk_decide_student_verification", { ids_input: parsed.data.ids, decision_input: parsed.data.decision, reason_input: parsed.data.reason });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "Verification access is required.") : safeErrorResponse(error);
  return NextResponse.json({ results: data }, { headers: { "Cache-Control": "private, no-store" } });
}
