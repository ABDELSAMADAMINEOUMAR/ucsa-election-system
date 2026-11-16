import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { requireApiUser, errorResponse, sameOrigin } from "@/lib/supabase/http";
const schema = z
  .object({
    electionId: z.uuid(),
    registerId: z.uuid(),
    ruleReference: z.string().trim().min(5).max(500),
    excluded: z.array(z.string().regex(/^[A-Z0-9/-]{3,40}$/)).max(5000),
    confirmed: z.literal(true),
  })
  .strict();
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const input = schema.safeParse(await readBoundedJson(request));
  if (!input.success)
    return errorResponse(
      400,
      "Select a register, election, approved rule, and confirm the decision.",
    );
  const d = input.data;
  const result = await auth.session.client.rpc("approve_register_eligibility", {
    election_input: d.electionId,
    register_input: d.registerId,
    reference_input: d.ruleReference,
    excluded_input: d.excluded,
  });
  if (result.error)
    return errorResponse(
      409,
      "The plan could not be approved. Check permissions, version, exceptions, and election state.",
    );
  return NextResponse.json({ included: result.data });
}
