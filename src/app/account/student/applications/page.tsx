import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { CandidateApplicationForm } from "@/components/account/workspaces";

function requestTime() {
  return Date.now();
}

function relatedTitle(value: unknown) {
  if (Array.isArray(value))
    return (value[0] as { title?: string } | undefined)?.title;
  return (value as { title?: string } | null)?.title;
}

export default async function Page() {
  await connection();
  const { client, user } = await requireStudentAccess(
    "/account/student/applications",
  );
  const [applicationResult, electionResult] = await Promise.all([
    client
      .from("candidate_applications")
      .select(
        "id,election_id,office_id,status,biography,manifesto,submitted_at,created_at,candidate_review_decisions(decision,reason,decided_at),elections(title),election_offices(title)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    client
      .from("elections")
      .select(
        "id,title,status,nominations_start,nominations_end,election_offices!election_offices_election_id_fkey(id,title)",
      )
      .in("status", ["draft", "prepared", "open", "closed", "certified"]),
  ]);
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("verification_status")
    .eq("id", user.id)
    .maybeSingle();
  const { data: eligibility, error: eligibilityError } = await client
    .from("election_eligibility")
    .select("election_id,status")
    .eq("user_id", user.id)
    .eq("status", "verified");
  if (
    applicationResult.error ||
    electionResult.error ||
    profileError ||
    eligibilityError
  )
    throw new Error("Your application information is unavailable.");
  const applications = applicationResult.data;
  const elections = electionResult.data;
  const allowed = new Set(eligibility?.map((row) => row.election_id) ?? []);
  const candidateLists = await Promise.all(
    (elections ?? []).map(async (election) => ({
      election,
      result: await client.rpc("get_my_candidates", {
        election_input: election.id,
      }),
    })),
  );
  const now = requestTime();
  const openElections = (elections ?? []).filter(
    (election) =>
      allowed.has(election.id) &&
      profile?.verification_status === "verified" &&
      now >= Date.parse(election.nominations_start) &&
      now <= Date.parse(election.nominations_end),
  );
  return (
    <main className="container stack account-workspace">
      <Link className="text-link" href="/account/student">
        <ArrowLeft size={16} /> Student workspace
      </Link>
      <PageHeader
        eyebrow="STUDENT / CANDIDACY"
        title="Candidates and applications"
        description="Apply for an available position during nominations and follow your application status."
      />
      <Card>
        <h2>Application requirements</h2>
        <p>
          Your email and student identity must be verified, your eligibility
          must be explicitly approved for the selected election, and its
          nomination window must be open. Prepare your motivation, relevant
          experience and optional portrait before submitting.
        </p>
        <p className="muted small">
          Drafts can be edited before submission. Committee decisions and
          voting-stage restrictions remain enforced by the server.
        </p>
      </Card>
      {candidateLists.map(({ election, result }) =>
        result.data?.length ? (
          <Card key={election.id} className="stack">
            <h2>{election.title}: approved candidates</h2>
            {(
              result.data as {
                name: string;
                position: string;
                motivation: string;
                experience: string;
              }[]
            ).map((c, index) => (
              <details key={index}>
                <summary>
                  {c.name} ? {c.position}
                </summary>
                <h3>Motivation and plans</h3>
                <p>{c.motivation}</p>
                <h3>Relevant experience</h3>
                <p>{c.experience}</p>
              </details>
            ))}
          </Card>
        ) : null,
      )}
      <CandidateApplicationForm
        elections={openElections}
        applications={applications ?? []}
      />
      {applications?.map((application) => (
        <Card key={application.id} className="secure-record">
          <div className="secure-record-title">
            <ClipboardList />
            <div>
              <h2>{relatedTitle(application.election_offices)}</h2>
              <p>{relatedTitle(application.elections)}</p>
            </div>
            <Badge
              tone={
                application.status === "approved"
                  ? "green"
                  : application.status === "rejected"
                    ? "red"
                    : "yellow"
              }
            >
              {application.status}
            </Badge>
          </div>
          <p>
            {application.submitted_at
              ? `Submitted ${new Date(application.submitted_at).toLocaleDateString()}`
              : "Draft · Only you can access this application"}
          </p>
          <p className="muted small">
            Private application record · Real authenticated session
          </p>
        </Card>
      ))}
      {!openElections.length && (
        <Card>
          <h2>No eligible nomination window</h2>
          <p>
            Application submission requires a verified account, election
            specific eligibility, and an active nomination period.
          </p>
        </Card>
      )}
    </main>
  );
}
