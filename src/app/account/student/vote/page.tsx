import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { Card, PageHeader } from "@/components/ui";
import { isSyntheticVotingEnabled } from "@/lib/voting-policy";

export default async function Page() {
  await connection();
  const { client, user } = await requireStudentAccess("/account/student/vote");
  if (!isSyntheticVotingEnabled(process.env.UCSA_DEPLOYMENT_MODE, process.env.UCSA_SYNTHETIC_VOTING_ENABLED)) {
    return <main className="container stack account-workspace"><PageHeader eyebrow="UCSA ELECTIONS" title="Electronic voting is disabled" description="This platform supports election management. Real electronic voting requires independent review and approval." /><Card><h2>Continue using your student workspace</h2><p>You can follow candidates, manage applications and contact the committee.</p><Link className="text-link" href="/account/student">Student dashboard</Link></Card></main>;
  }
  const [{ data: elections }, { data: eligibility }] = await Promise.all([
    client
      .from("elections")
      .select("id,title,description,status,voting_start,voting_end")
      .eq("status", "open")
      .order("voting_start"),
    client
      .from("election_eligibility")
      .select("election_id,status")
      .eq("user_id", user.id)
      .eq("status", "verified"),
  ]);
  const eligible = new Set((eligibility ?? []).map((item) => item.election_id));
  return (
    <main className="container stack account-workspace">
      <PageHeader
        eyebrow="UCSA ELECTIONS"
        title="Elections"
        description="View your eligible elections and vote during the authorized window."
      />
      {(elections ?? [])
        .filter((election) => eligible.has(election.id))
        .map((election) => (
          <Card key={election.id}>
            <h2>{election.title}</h2>
            <p>{election.description}</p>
            <p>
              Scheduled through{" "}
              {new Date(election.voting_end).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}
            </p>
            <Link
              className="text-link"
              href={`/account/student/vote/${election.id}`}
            >
              Open secure ballot <ArrowRight size={16} />
            </Link>
          </Card>
        ))}
      {!(elections ?? []).some((election) => eligible.has(election.id)) && (
        <Card>
          <h2>No available ballot</h2>
          <p>
            There is no open election with approved eligibility for this
            account.
          </p>
        </Card>
      )}
    </main>
  );
}
