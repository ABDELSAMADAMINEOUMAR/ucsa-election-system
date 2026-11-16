import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

const schema = z.object({ electionId: z.string().uuid(), category: z.enum(["eligibility", "candidate_conduct", "campaign_process", "voting_access", "election_process", "other"]), description: z.string().trim().min(20).max(5000) }).strict();

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { data: roles } = await auth.session.client.from("committee_members").select("role").in("role", ["certifying_officer", "committee_chair"]).limit(1);
  const committee = Boolean(roles?.length);
  const { data, error } = committee
    ? await auth.session.client.rpc("list_committee_complaints", { election_id_input: null })
    : await auth.session.client.from("complaints").select("id,reference_code,election_id,category,status,created_at,updated_at,closed_at").order("created_at", { ascending: false });
  if (error) return errorResponse(500, "Complaints could not be loaded.");
  return NextResponse.json({ complaints: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const parsed = schema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Please check the complaint details.");
  const { data, error } = await auth.session.client.rpc("submit_complaint", { election_id_input: parsed.data.electionId, category_input: parsed.data.category, description_input: parsed.data.description });
  if (error) return errorResponse(400, "The complaint could not be submitted. Check your verified account and election details.");
  return NextResponse.json({ complaint: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
