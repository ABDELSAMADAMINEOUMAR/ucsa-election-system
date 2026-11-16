import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const parsed = z.object({ electionId: z.uuid(), page: z.number().int().min(1).max(100000), search: z.string().trim().max(120) }).strict().safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Choose an election and check the filters.");
  const { electionId, page, search } = parsed.data;
  const role = await auth.session.client.rpc("has_committee_role", { allowed: ["verification_officer", "committee_chair"], scoped_election: electionId });
  if (role.error || role.data !== true) return errorResponse(403, "You are not authorized for this election.");
  let query = auth.session.client.from("profiles").select("id,full_name,email,registration_number", { count: "exact" }).eq("verification_status", "verified").order("full_name").order("id").range((page - 1) * 25, page * 25 - 1);
  if (search) query = query.ilike("full_name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const students = await query;
  if (students.error) return safeErrorResponse(students.error);
  const eligibility = students.data?.length ? await auth.session.client.from("election_eligibility").select("user_id,status,reason").eq("election_id", electionId).in("user_id", students.data.map(row => row.id)) : { data: [], error: null };
  if (eligibility.error) return safeErrorResponse(eligibility.error);
  return NextResponse.json({ total: students.count ?? 0, records: students.data?.map(student => ({ ...student, eligibility: eligibility.data?.find(row => row.user_id === student.id) ?? null })) ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
