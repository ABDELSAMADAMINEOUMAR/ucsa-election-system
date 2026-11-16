import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createElectionPdf, type ReportLine } from "@/lib/reports/pdf";
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/public/elections/[id]/results.pdf">) {
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const client = await createSupabaseServerClient(); const { data } = await client.rpc("get_published_election_results", { election_id_input: id });
  if (!data) return new NextResponse("Not found", { status: 404 });
  const election = data.election as { title: string; votingStart: string; votingEnd: string; offices: { officeTitle: string; candidates: { name: string; votes: number; percentage: number; tiedAtTop: boolean; rank: number }[] }[] };
  const lines: ReportLine[] = [{ text: `Voting period: ${election.votingStart} — ${election.votingEnd}` }, ...election.offices.flatMap((office) => [{ heading: office.officeTitle, text: "Certified and publicly published results" }, { columns: ["Candidate", "Votes", "Share", "Rank / status"] }, ...office.candidates.map((candidate) => ({ columns: [candidate.name, String(candidate.votes), `${Number(candidate.percentage).toFixed(2)}%`, `${candidate.rank}${candidate.tiedAtTop ? " · tie" : ""}`] }))])];
  lines.push({ text: `Certification reference: ${data.certificationReference}` }, { text: `Published: ${data.publishedAt}` }, { text: "A top tie is not a winner determination; apply authoritative UCSA rules." });
  const bytes = await createElectionPdf("Certified results", election.title, String(data.certificationReference), lines);
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ucsa-certified-results-${id.slice(0, 8)}.pdf"`, "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
}
