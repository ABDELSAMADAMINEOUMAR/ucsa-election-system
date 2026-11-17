import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "./server";
import { isSupabaseConfigured } from "./shared";
import { authOrigin } from "@/lib/auth-redirect";

/** Consume the PKCE code server-side; never log or forward credential parameters. */
export async function completeAuthCallback(
  request: NextRequest,
  destination: string,
  failure: string,
) {
  let succeeded = false;
  const code = request.nextUrl.searchParams.get("code");
  if (
    isSupabaseConfigured() &&
    code &&
    !request.nextUrl.searchParams.has("error")
  ) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      succeeded = !error;
    } catch {
      // Do not expose provider errors, codes, cookies, or reset URLs.
    }
  }
  const response = NextResponse.redirect(
    new URL(
      succeeded ? destination : failure,
      authOrigin(request.nextUrl.origin),
    ),
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
