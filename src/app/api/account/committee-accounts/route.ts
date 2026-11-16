import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const role = await auth.session.client.rpc("has_committee_role", { allowed: ["committee_chair"] });
  if (role.error || role.data !== true) return errorResponse(403, "Only a global committee chair may find accounts for role assignment.");
  const parsed = z.object({ search: z.string().trim().min(3).max(120) }).strict().safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Enter at least 3 characters of the authorized account email.");
  const search = parsed.data.search.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await auth.session.client.from("profiles").select("id,full_name,email").ilike("email", `%${search}%`).order("email").limit(25);
  if (error) return safeErrorResponse(error);
  return NextResponse.json({ accounts: data }, { headers: { "Cache-Control": "private, no-store" } });
}
