import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { candidateSchema } from "@/lib/schemas/account";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse, isCommitteeRole } from "@/lib/supabase/http";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  if (!(await isCommitteeRole(auth.session.client, ["candidate_review_officer", "committee_chair"]))) return errorResponse(403, "You are not authorized to review applications.");
  const { data, error } = await auth.session.client.from("candidate_review_queue").select("id,election_id,office_id,user_id,full_name,biography,manifesto,status,submitted_at,office_title,election_title").order("submitted_at", { ascending: false });
  if (error) return safeErrorResponse(error);
  const ids = (data ?? []).map((row) => row.id);
  const docs = ids.length ? await auth.session.client.from("candidate_application_documents").select("application_id,storage_path").in("application_id", ids) : { data: [], error: null };
  const items = await Promise.all((data ?? []).map(async (application) => {
    const document = docs.data?.find((item) => item.application_id === application.id);
    if (!document) return { ...application, photoUrl: null };
    const { data: url } = await auth.session.client.storage.from("candidate-private").createSignedUrl(document.storage_path, 60);
    return { ...application, photoUrl: url?.signedUrl ?? null };
  }));
  return NextResponse.json({ applications: items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const parsed = candidateSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Check the election, office, biography, and manifesto.");
  const application = { election_id: parsed.data.electionId, office_id: parsed.data.officeId, biography: parsed.data.biography, manifesto: parsed.data.manifesto };
  const { data, error } = await auth.session.client.from("candidate_applications").insert({
    ...application,
    user_id: auth.session.user.id,
    status: "draft",
    submitted_at: null,
  }).select("id").single();
  if (error?.code === "23505") {
    const existing = await auth.session.client.from("candidate_applications").select("id,status").eq("user_id", auth.session.user.id).eq("election_id", parsed.data.electionId).eq("office_id", parsed.data.officeId).maybeSingle();
    if (!existing.error && existing.data?.status === "draft") return NextResponse.json({ id: existing.data.id }, { headers: { "Cache-Control": "private, no-store" } });
    return errorResponse(409, "You have already applied for this office.");
  }
  if (error) return errorResponse(403, "Applications require verified student and election specific eligibility during an active nomination window.");
  return NextResponse.json({ id: data.id }, { status: 201 });
}
