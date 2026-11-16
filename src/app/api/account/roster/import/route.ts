import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/bounded-body";
import { importSchema } from "@/lib/schemas/bulk";
import { errorResponse, isCommitteeRole, requireApiUser, sameOrigin } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  if (!await isCommitteeRole(auth.session.client, ["committee_chair"])) return errorResponse(403, "Only the committee chair may import the roster.");
  const parsed = importSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Confirm a valid batch of up to 250 unique records.");
  const rows = parsed.data.records.map(row => ({ registration_number: row.registrationNumber, email: row.email, status: row.status, full_name: row.fullName, academic_program: row.academicProgram, expected: row.expected }));
  const { data, error } = await auth.session.client.rpc("import_roster_details", { rows_input: rows });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "Only a global chair may import the roster.") : errorResponse(409, "This batch was not imported. Refresh the roster and resolve conflicting records.");
  return NextResponse.json({ imported: data }, { headers: { "Cache-Control": "private, no-store" } });
}
