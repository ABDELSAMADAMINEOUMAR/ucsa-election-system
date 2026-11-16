import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, errorResponse } from "@/lib/supabase/http";
import { createElectionPdf, type ReportLine } from "@/lib/reports/pdf";
export async function GET(
  _request: NextRequest,
  { params }: RouteContext<"/api/account/elections/[id]/published-results.pdf">,
) {
  const auth = await requireApiUser();
  if (!auth.session) return auth.error;
  const { id } = await params;
  const result = await auth.session.client.rpc("get_rehearsal_results", {
    election_id_input: id,
  });
  if (result.error || !result.data)
    return errorResponse(403, "Published results are unavailable.");
  const data = result.data;
  const lines: ReportLine[] = [
    {
      text: "Synthetic local rehearsal only; not an authorized real election.",
    },
  ];
  for (const office of data.election.offices as {
    officeTitle: string;
    candidates: {
      name: string;
      votes: number;
      percentage: number;
      tiedAtTop: boolean;
    }[];
  }[]) {
    lines.push(
      { heading: office.officeTitle },
      { columns: ["Candidate", "Votes", "Share"] },
    );
    for (const c of office.candidates)
      lines.push({
        columns: [
          c.name,
          String(c.votes),
          `${Number(c.percentage).toFixed(2)}%${c.tiedAtTop ? " · tie" : ""}`,
        ],
      });
  }
  lines.push({
    text: "Apply approved UCSA winner/tie rules. No ballot-level information is included.",
  });
  const bytes = await createElectionPdf(
    "Certified rehearsal results",
    data.election.title,
    data.certificationReference,
    lines,
  );
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=ucsa-rehearsal-results.pdf",
      "Cache-Control": "private, no-store",
    },
  });
}
