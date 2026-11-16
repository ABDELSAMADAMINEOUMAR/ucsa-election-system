import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { requireApiUser, errorResponse, sameOrigin } from "@/lib/supabase/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const input = z
    .object({ electionId: z.uuid(), confirmed: z.literal(true) })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!input.success)
    return errorResponse(400, "Confirm the approved candidate slate.");
  const result = await auth.session.client.rpc("finalize_candidate_slate", {
    election_input: input.data.electionId,
  });
  if (result.error)
    return errorResponse(
      409,
      "Finish nominations, approvals and independent review before finalizing.",
    );
  return NextResponse.json({ finalized: true });
}
