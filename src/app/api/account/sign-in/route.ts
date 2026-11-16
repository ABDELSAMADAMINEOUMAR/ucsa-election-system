import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, safeErrorResponse, sameOrigin } from "@/lib/supabase/http";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  if (!isSupabaseConfigured()) return errorResponse(503, "Secure services are not configured yet.");
  try {
    const parsed = loginSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) return errorResponse(400, "Enter a valid email and password.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return errorResponse(401, "Email or password is incorrect, or email confirmation is still required.");
    const { data } = await supabase.auth.getUser();
    return NextResponse.json({ ok: true, next: data.user ? "/account" : "/account/sign-in" });
  } catch (error) { return safeErrorResponse(error); }
}



