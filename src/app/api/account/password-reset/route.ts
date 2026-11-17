import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, sameOrigin } from "@/lib/supabase/http";
import { isSupabaseConfigured } from "@/lib/supabase/shared";
import { publicRateLimit } from "@/lib/public-rate-limit";
import { recoveryCallbackUrl } from "@/lib/auth-redirect";
import { requestRecoveryDelivery } from "@/lib/recovery-delivery";

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
  const acknowledgement = await requestRecoveryDelivery(async () => {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.resetPasswordForEmail(
      parsed.data.email.trim().toLowerCase(),
      {
        redirectTo: recoveryCallbackUrl(request.nextUrl.origin),
      },
    );
  });
  return NextResponse.json(acknowledgement, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
