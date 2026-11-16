import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { electionEligibilitySchema } from "@/lib/schemas/account";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const parsed = electionEligibilitySchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Check the election, student, and decision details.");
  const { electionId, userId, decision, reason } = parsed.data;
  const { error } = await auth.session.client.rpc("decide_election_eligibility", {
    election_id_input: electionId, user_id_input: userId, decision_input: decision, reason_input: reason,
  });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "You are not authorized for this election.") : errorResponse(409, "Eligibility could not be updated.");
  return NextResponse.json({ ok: true });
}
