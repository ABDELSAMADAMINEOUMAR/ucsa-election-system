import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rosterImportRow } from "@/lib/roster-import";
import { readBoundedJson } from "@/lib/bounded-body";
import {
  errorResponse,
  requireApiUser,
  sameOrigin,
  safeErrorResponse,
} from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const role = await auth.session.client.rpc("has_committee_role", {
    allowed: ["committee_chair"],
  });
  if (role.error || role.data !== true)
    return errorResponse(
      403,
      "Only a global committee chair may preview the roster.",
    );
  const parsed = z
    .object({ records: z.array(rosterImportRow).min(1).max(250) })
    .strict()
    .safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Check the preview records.");
  const { data, error } = await auth.session.client.rpc(
    "preview_roster_records",
    {
      rows_input: parsed.data.records.map((row) => ({
        registration_number: row.registrationNumber,
        email: row.email,
      })),
    },
  );
  if (error) return safeErrorResponse(error);
  return NextResponse.json(
    { records: data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
