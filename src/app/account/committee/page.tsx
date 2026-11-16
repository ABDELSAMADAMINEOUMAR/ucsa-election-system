import { connection } from "next/server";
import Link from "next/link";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { Card, Notice, PageHeader, Badge } from "@/components/ui";
export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole([
    "committee_chair",
    "verification_officer",
    "election_administrator",
    "candidate_review_officer",
    "certifying_officer",
  ]);
  const [summary, applications, elections] = await Promise.all([
    client.rpc("committee_register_summary"),
    client
      .from("candidate_review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    client
      .from("elections")
      .select(
        "id,title,status,voting_start,voting_end,election_classifications!inner(classification)",
      )
      .order("voting_start", { ascending: false })
      .limit(6),
  ]);
  const data = summary.data;
  const next =
    data && !data.registerReady
      ? {
          href: "/account/committee/roster",
          label: "Upload and approve the voter register",
        }
      : data?.stagedVersions
        ? {
            href: "/account/committee/roster",
            label: "Review staged register versions",
          }
        : applications.count
          ? {
              href: "/account/committee/candidates",
              label: "Review pending candidate applications",
            }
          : {
              href: "/account/committee/elections",
              label: "Review election setup and schedule",
            };
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="UCSA COMMITTEE"
        title="Dashboard"
        description="The next action, approved electorate and election schedule."
      />
      {data && (
        <div className="student-summary">
          <div>
            <span className="muted">Approved register entries</span>
            <strong>{data.approvedVoters}</strong>
          </div>
          <div>
            <span className="muted">Pending register exceptions</span>
            <strong>{data.pendingExceptions}</strong>
          </div>
        </div>
      )}
      <Card className="stack">
        <h2>Next committee action</h2>
        <Link className="btn btn-primary" href={next.href}>
          {next.label}
        </Link>
        <p>
          {applications.error
            ? "Pending applications are unavailable."
            : `${applications.count ?? 0} visible candidate applications need a decision.`}
        </p>
      </Card>
      <section className="stack">
        <h2>Current elections</h2>
        {elections.error ? (
          <Notice>Election information is temporarily unavailable.</Notice>
        ) : elections.data?.length ? (
          elections.data.map((e) => (
            <Card key={e.id}>
              <div className="heading-row">
                <h3>{e.title}</h3>
                <Badge>{e.status}</Badge>
              </div>
              <p>
                {new Date(e.voting_start).toLocaleString("en-RW", {
                  timeZone: "Africa/Kigali",
                })}{" "}
                ?{" "}
                {new Date(e.voting_end).toLocaleString("en-RW", {
                  timeZone: "Africa/Kigali",
                })}
              </p>
            </Card>
          ))
        ) : (
          <p>
            No classified election is currently configured. Historical records
            remain in Administration.
          </p>
        )}
      </section>
      <Notice>
        Counts are authorized local register records, not an institutional
        election approval. Real elections remain disabled.
      </Notice>
    </main>
  );
}
