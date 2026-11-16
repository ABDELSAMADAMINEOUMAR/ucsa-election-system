import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, errorResponse } from "@/lib/supabase/http";
import {
  canonicalRegisterCsv,
  registerExcelTemplate,
} from "@/lib/official-register-file";
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const role = await auth.session.client.rpc("has_committee_role", {
    allowed: ["committee_chair", "verification_officer"],
  });
  if (role.data !== true) return errorResponse(403, "Not authorized.");
  const excel = request.nextUrl.searchParams.get("format") === "xlsx";
  const body = excel
    ? new Uint8Array(registerExcelTemplate()).buffer
    : canonicalRegisterCsv([
        {
          fullName: "Fictional Student — replace before import",
          registrationNumber: "UCSA/2026/001",
          email: "student@example.test",
        },
      ]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": excel
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="ucsa-voter-template.${excel ? "xlsx" : "csv"}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
