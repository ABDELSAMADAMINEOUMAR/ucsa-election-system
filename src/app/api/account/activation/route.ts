import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { sameOrigin, errorResponse } from "@/lib/supabase/http";
import { readBoundedJson } from "@/lib/bounded-body";
import { publicRateLimit } from "@/lib/public-rate-limit";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await getAuthenticatedUser();
  if (!auth) return errorResponse(401, "Sign in and confirm your email first.");
  const parsed = z
    .object({
      registrationNumber: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9/-]{3,40}$/),
    })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!parsed.success)
    return errorResponse(400, "Check your registration number.");
  if (!(await publicRateLimit("activation", auth.user.id)))
    return errorResponse(
      429,
      "Please wait before trying again or contact the committee.",
    );
  const result = await auth.client.rpc("bind_official_voter", {
    registration_input: parsed.data.registrationNumber,
  });
  if (result.error || result.data?.activated !== true)
    return errorResponse(
      403,
      "Unable to activate this account. Check your details or contact the committee.",
    );
  return NextResponse.json({ activated: true });
}
