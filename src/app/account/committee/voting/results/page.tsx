import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { Card, Notice, PageHeader } from "@/components/ui";

type Row = { office_id: string; office_title: string; candidate_application_id: string; candidate_name: string; vote_count: number };
export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole(["certifying_officer", "committee_chair"]);
  const { data: elections } = await client.from("elections").select("id,title,status,voting_end").eq("status", "closed").order("voting_end", { ascending: false });
  const completed = await Promise.all((elections ?? []).map(async (election) => {
    const { data, error } = await client.rpc("get_closed_election_tally", { election_id_input: election.id });
    return error ? null : { id: election.id, title: election.title, rows: (data ?? []) as Row[] };
  }));
  return <main className="container stack account-workspace"><PageHeader eyebrow="CERTIFYING OFFICER · RESTRICTED" title="Closed election review" description="Candidate counts are queried from PostgreSQL only after the scheduled voting end. This page is a confidential review preview, not certification or publication."/><Notice tone="yellow">Counts are hidden from students and other committee roles. Opening this page does not certify results. Operator-level database correlation and tampering risks remain.</Notice>
    {completed.filter(Boolean).map((election) => <Card className="stack" key={election!.id}><h2>{election!.title}</h2>{Array.from(new Set(election!.rows.map((row) => row.office_id))).map((officeId) => { const rows = election!.rows.filter((row) => row.office_id === officeId); const total = rows.reduce((sum, row) => sum + Number(row.vote_count), 0); return <section className="stack" key={officeId}><h3>{rows[0]?.office_title}</h3>{rows.map((row) => <div className="secure-list-row" key={row.candidate_application_id}><span>{row.candidate_name}</span><strong>{row.vote_count} ballots{total > 0 ? ` · ${Math.round(Number(row.vote_count) / total * 100)}%` : " · 0%"}</strong></div>)}</section>; })}{!election!.rows.length && <p>No approved candidates/results are available.</p>}<p className="muted small">Restricted preliminary tally · Not certified or published</p></Card>)}
    {!completed.some(Boolean) && <Card><h2>No results available</h2><p>Results remain unavailable while an election is open or until its scheduled close has passed.</p></Card>}
  </main>;
}
