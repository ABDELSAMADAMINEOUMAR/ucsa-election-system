import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Card, Notice, PageHeader } from "@/components/ui";
type Office = {
  officeTitle: string;
  candidates: {
    name: string;
    votes: number;
    percentage: number;
    tiedAtTop: boolean;
  }[];
};
export async function PublishedResults({
  client,
  electionId,
}: {
  client: SupabaseClient;
  electionId: string;
}) {
  const result = await client.rpc("get_rehearsal_results", {
    election_id_input: electionId,
  });
  if (result.error || !result.data)
    return (
      <main className="account-workspace stack">
        <PageHeader
          eyebrow="ELECTION RESULTS"
          title="Results are not available"
          description="Only certified results published by an authorized chair are shown to permitted viewers."
        />
      </main>
    );
  const data = result.data;
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="PUBLISHED LOCAL REHEARSAL"
        title={data.election.title}
        description={`Certified reference: ${data.certificationReference}`}
      />
      <Notice>
        These are certified synthetic rehearsal results, not an authorized real
        election.
      </Notice>
      {(data.election.offices as Office[]).map((office, index) => (
        <Card key={index} className="stack">
          <h2>{office.officeTitle}</h2>
          {office.candidates.map((candidate, i) => (
            <div className="secure-list-row" key={i}>
              <strong>
                {candidate.name}
                {candidate.tiedAtTop ? " · Top tie" : ""}
              </strong>
              <span>
                {candidate.votes} votes ·{" "}
                {Number(candidate.percentage).toFixed(2)}%
              </span>
            </div>
          ))}
        </Card>
      ))}
      <p>
        Winner and tie decisions must follow approved UCSA rules. No
        ballot-level information is included.
      </p>
      <Link
        className="btn btn-secondary"
        href={`/api/account/elections/${electionId}/published-results.pdf`}
      >
        Download certified results PDF
      </Link>
    </main>
  );
}
