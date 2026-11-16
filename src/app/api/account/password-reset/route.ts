import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, sameOrigin } from "@/lib/supabase/http";
import { isSupabaseConfigured } from "@/lib/supabase/shared";
import { publicRateLimit } from "@/lib/public-rate-limit";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  if (!isSupabaseConfigured())
    return errorResponse(503, "Secure services are not configured yet.");
  const parsed = z
    .object({ email: z.email().max(254) })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!parsed.success)
    return errorResponse(400, "Enter a valid email address.");
  if (!(await publicRateLimit("recovery", parsed.data.email)))
    return errorResponse(429, "Please wait before requesting another email.");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(
    parsed.data.email.trim().toLowerCase(),
    {
      redirectTo: `${request.nextUrl.origin}/account/callback?next=/account/reset-password/new`,
    },
  );
  return NextResponse.json({
    message:
      "If an account exists for this address, password reset instructions will arrive by email.",
  });
}
