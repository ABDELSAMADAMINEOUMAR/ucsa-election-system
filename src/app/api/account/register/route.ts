import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { registrationSchema } from "@/lib/schemas/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  errorResponse,
  safeErrorResponse,
  sameOrigin,
} from "@/lib/supabase/http";
import {
  isPublicRegistrationEnabled,
  isSupabaseConfigured,
} from "@/lib/supabase/shared";
import { publicRateLimit } from "@/lib/public-rate-limit";
import { authCallbackUrl } from "@/lib/auth-redirect";

const confirmationResponse = {
  message:
    "If this request can proceed, email confirmation instructions will be sent. Confirm your email, then activate using your official registration number.",
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  if (!isPublicRegistrationEnabled())
    return errorResponse(
      503,
      "Online student registration is currently closed.",
    );
  if (!isSupabaseConfigured())
    return errorResponse(503, "Secure services are not configured yet.");
  try {
    const parsed = registrationSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success)
      return errorResponse(
        400,
        "Check your registration number, email, and password requirements.",
      );
    if (!(await publicRateLimit("signup", parsed.data.email)))
      return errorResponse(429, "Please wait before trying again.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      // This metadata is an untrusted claim, never authority or a name source.
      options: {
        data: { requested_registration: parsed.data.registrationNumber },
        emailRedirectTo: authCallbackUrl(request.nextUrl.origin, "/account/activate"),
      },
    });
    // Keep body and status indistinguishable for new, existing and rejected
    // addresses. Supabase confirmation email remains the authoritative signal.
    void error;
    return NextResponse.json(confirmationResponse, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
