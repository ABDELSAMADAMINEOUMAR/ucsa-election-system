import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, sameOrigin, errorResponse } from "@/lib/supabase/http";
import { readBoundedJson } from "@/lib/bounded-body";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const input = z
    .object({
      id: z.uuid(),
      status: z.enum(["reviewed", "resolved", "rejected"]),
      response: z.string().trim().min(3).max(1000),
    })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!input.success) return errorResponse(400, "Provide a review response.");
  const r = await auth.session.client.rpc("review_membership_support", {
    id_input: input.data.id,
    status_input: input.data.status,
    response_input: input.data.response,
  });
  if (r.error) return errorResponse(403, "Review is not authorized.");
  return NextResponse.json({ recorded: true });
}
