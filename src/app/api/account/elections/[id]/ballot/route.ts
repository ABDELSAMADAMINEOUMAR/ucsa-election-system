import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";
import { isSyntheticVotingEnabled } from "@/lib/voting-policy";

const payloadSchema = z.object({
  selections: z.array(z.object({ officeId: z.string().uuid(), candidateId: z.string().uuid() }).strict()).min(1).max(20),
}).strict();
const uuid = z.string().uuid();

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/account/elections/[id]/ballot">) {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return errorResponse(400, "Election is unavailable.");
  const [{ data: ballot, error: ballotError }, { data: status, error: statusError }] = await Promise.all([
    auth.session.client.rpc("get_open_ballot", { election_id_input: id }),
    auth.session.client.rpc("get_my_vote_status", { election_id_input: id }),
  ]);
  if (statusError) return errorResponse(500, "Voting status could not be loaded.");
  if (ballotError) return errorResponse(403, "You are not eligible to view this ballot, or voting is not open.");
  return NextResponse.json({ ballot, recordedOfficeIds: status?.map((item: { office_id: string }) => item.office_id) ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/elections/[id]/ballot">) {
  if (!isSyntheticVotingEnabled(process.env.UCSA_DEPLOYMENT_MODE, process.env.UCSA_SYNTHETIC_VOTING_ENABLED)) {
    return errorResponse(503, "Ballot submission is disabled in this management deployment. Real electronic voting is not authorized.");
  }
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return errorResponse(400, "The ballot could not be submitted.");
  let raw: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return errorResponse(400, "The ballot could not be submitted.");
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > 8192) { await reader.cancel(); return errorResponse(413, "The ballot could not be submitted."); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return errorResponse(400, "The ballot could not be submitted."); }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success || new Set(parsed.data?.selections.map((item) => item.officeId)).size !== parsed.data?.selections.length) return errorResponse(400, "The ballot could not be submitted.");
  const { error } = await auth.session.client.rpc("submit_election_ballot", {
    election_id_input: id,
    selections_input: parsed.data.selections.map((item) => ({ office_id: item.officeId, candidate_application_id: item.candidateId })),
  });
  if (error) {
    // No database detail is returned or logged: duplicate, stale, and invalid submissions are not distinguishable.
    return errorResponse(409, "The ballot could not be recorded. Check your participation status or try again.");
  }
  return NextResponse.json({ recorded: true, message: "Your ballot submission was recorded." }, { headers: { "Cache-Control": "private, no-store" } });
}
