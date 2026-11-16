import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, safeErrorResponse, sameOrigin } from "@/lib/supabase/http";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true });
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return errorResponse(503, "Sign out could not be completed. Please try again.");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return safeErrorResponse(error);
  }
}
