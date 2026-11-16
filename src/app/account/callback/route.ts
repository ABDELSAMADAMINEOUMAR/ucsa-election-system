import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = request.nextUrl.searchParams.get("next");
  const safeNext = destination?.startsWith("/account/") || destination === "/account" ? destination : "/account";
  if (!isSupabaseConfigured() || !code) return NextResponse.redirect(new URL("/account/sign-in?notice=link-invalid", request.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/account/sign-in?notice=link-invalid" : safeNext, request.url));
}
