import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { rosterSchema } from "@/lib/schemas/account";
import { errorResponse, isCommitteeRole, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  if (!(await isCommitteeRole(auth.session.client, ["committee_chair"]))) return errorResponse(403, "Only the committee chair may access the approved student roster.");
  const { data, error } = await auth.session.client.from("eligible_students").select("id,registration_number,verified_email,roster_status,imported_at").order("registration_number");
  if (error) return safeErrorResponse(error);
  return NextResponse.json({ records: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const parsed = rosterSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, parsed.error.issues[0]?.message ?? "Check roster data.");
  const rows = parsed.data.records.map((row) => ({ registration_number: row.registrationNumber, email: row.email, status: row.status }));
  const { data, error } = await auth.session.client.rpc("import_eligible_students", { rows_input: rows });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "Only the committee chair may import approved student records.") : errorResponse(409, "The roster could not be updated. Resolve any existing registration number or email conflicts.");
  return NextResponse.json({ imported: data });
}
