import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, sameOrigin } from "@/lib/supabase/http";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  if (!isSupabaseConfigured()) return errorResponse(503, "Secure services are not configured yet.");
  const body = z.object({ password: z.string().min(12).max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p)) }).strict().safeParse(await readBoundedJson(request));
  if (!body.success) return errorResponse(400, "Use at least 12 characters with a letter and a number.");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse(401, "The password reset link has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: body.data.password });
  if (error) return errorResponse(400, "The password could not be updated. Request a new reset link.");
  return NextResponse.json({ ok: true });
}
