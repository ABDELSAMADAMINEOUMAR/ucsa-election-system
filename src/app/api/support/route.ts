import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { errorResponse, sameOrigin } from "@/lib/supabase/http";
import { publicRateLimit } from "@/lib/public-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const input = z
    .object({
      email: z.email().max(254),
      message: z.string().trim().min(10).max(2000),
    })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!input.success)
    return errorResponse(
      400,
      "Enter an email and a message of 10–2,000 characters.",
    );
  if (!(await publicRateLimit("support", input.data.email, 5)))
    return errorResponse(429, "Please wait before sending another message.");
  const result = await createSupabaseAdminClient().rpc(
    "submit_membership_support",
    { email_input: input.data.email, message_input: input.data.message },
  );
  if (result.error)
    return errorResponse(
      503,
      "Support is temporarily unavailable. Please try again.",
    );
  return NextResponse.json({
    message:
      "Your request has been received. The committee will review it. This does not activate an account.",
    reference: result.data,
  });
}
