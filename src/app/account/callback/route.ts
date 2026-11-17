import { NextRequest } from "next/server";
import { completeAuthCallback } from "@/lib/supabase/callback";
import { authCallbackDestination } from "@/lib/auth-redirect";

export async function GET(request: NextRequest) {
  const destination = authCallbackDestination(
    request.nextUrl.searchParams.get("next"),
  );
  // Continue supporting previously sent PKCE recovery emails.
  return completeAuthCallback(
    request,
    destination,
    destination === "/account/reset-password/new"
      ? "/account/reset-password?notice=link-invalid"
      : "/account/sign-in?notice=link-invalid",
  );
}
