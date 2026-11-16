import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const role = await auth.session.client.rpc("has_committee_role", { allowed: ["committee_chair"] });
  if (role.error || role.data !== true) return errorResponse(403, "Only a global committee chair may view the roster.");
  const parsed = z.object({ page: z.number().int().min(1).max(100000), search: z.string().trim().max(40) }).strict().safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Check the roster filters.");
  const { page, search } = parsed.data;
  let query = auth.session.client.from("eligible_students").select("id,registration_number,verified_email,roster_status,full_name,academic_program,imported_at", { count: "exact" }).order("registration_number").range((page - 1) * 25, page * 25 - 1);
  if (search) query = query.ilike("registration_number", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, count } = await query;
  if (error) return safeErrorResponse(error);
  return NextResponse.json({ records: data, total: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
