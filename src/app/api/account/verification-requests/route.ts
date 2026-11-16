import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { verificationRequestSchema } from "@/lib/schemas/account";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse, isCommitteeRole } from "@/lib/supabase/http";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { data, error } = await auth.session.client.from("student_verification_requests")
    .select("id,user_id,requested_registration_number,status,reason,created_at,reviewed_at,reviewer_id").order("created_at", { ascending: false });
  if (error) return safeErrorResponse(error);
  if (await isCommitteeRole(auth.session.client, ["verification_officer", "committee_chair"])) return NextResponse.json({ requests: data }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ requests: data?.filter((request) => request.user_id === auth.session.user.id) ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const parsed = verificationRequestSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Enter a valid student registration number.");
  const { data, error } = await auth.session.client.rpc("submit_verification_request", { registration_number_input: parsed.data.registrationNumber });
  if (error) return errorResponse(409, "A verification request could not be submitted. Confirm your email and check whether an active request exists.");
  return NextResponse.json({ id: data }, { status: 201 });
}
