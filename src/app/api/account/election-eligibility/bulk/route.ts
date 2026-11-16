import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/bounded-body";
import { bulkEligibilitySchema } from "@/lib/schemas/bulk";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const parsed = bulkEligibilitySchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Choose an election and confirm up to 100 students. Rejection requires a reason.");
  const { electionId, ids, decision, reason } = parsed.data;
  const role = await auth.session.client.rpc("has_committee_role", { allowed: ["verification_officer", "committee_chair"], scoped_election: electionId });
  if (role.error || role.data !== true) return errorResponse(403, "You are not authorized for this election.");
  const { data, error } = await auth.session.client.rpc("bulk_decide_election_eligibility", { election_input: electionId, ids_input: ids, decision_input: decision, reason_input: reason });
  if (error) return errorResponse(error.message.includes("Not authorized") ? 403 : 409, "Eligibility decisions could not be processed for this election.");
  return NextResponse.json({ results: data }, { headers: { "Cache-Control": "private, no-store" } });
}
