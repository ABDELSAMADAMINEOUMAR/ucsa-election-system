import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";
import { candidateReviewSchema } from "@/lib/schemas/account";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/applications/[id]/decision">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse(400, "Invalid application.");
  const parsed = candidateReviewSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success || !["approved", "rejected"].includes(parsed.data.decision)) return errorResponse(400, "Choose approval or rejection and enter a reason when needed.");
  const { error } = await auth.session.client.rpc("decide_candidate_application", { application_id_input: id, decision_input: parsed.data.decision, reason_input: parsed.data.reason });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "You are not authorized for this election.") : errorResponse(409, "This application can no longer be reviewed.");
  return NextResponse.json({ ok: true });
}
