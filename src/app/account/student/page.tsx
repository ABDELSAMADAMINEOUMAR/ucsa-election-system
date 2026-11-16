import { connection } from "next/server";
import Link from "next/link";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { Card, Notice, PageHeader, Badge } from "@/components/ui";
export default async function Page() {
  await connection();
  const { client } = await requireStudentAccess();
  const membership = await client.rpc("get_my_membership");
  const elections = await client
    .from("elections")
    .select("id,title,status,nominations_end,voting_start,voting_end")
    .in("status", ["draft", "prepared", "open"])
    .order("voting_start");
  if (membership.error || elections.error)
    throw new Error("Your account information is unavailable.");
  const name = membership.data?.name ?? "Student";
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="UCSA STUDENT PORTAL"
        title={`Welcome, ${name.split(" ")[0]}.`}
        description="Your membership, elections and next steps in one place."
      />
      <div className="student-summary">
        <div>
          <span className="muted">Account status</span>
          <p>
            <Badge tone="green">Activated</Badge>
          </p>
        </div>
        <div>
          <span className="muted">Registration number</span>
          <p>{membership.data?.registrationNumber}</p>
        </div>
      </div>
      <section className="stack">
        <h2>Your elections</h2>
        {elections.data?.length ? (
          elections.data.map((e) => (
            <Card key={e.id}>
              <div className="heading-row">
                <h3>{e.title}</h3>
                <Badge tone={e.status === "open" ? "green" : "blue"}>
                  Eligible ? {e.status === "open" ? "Voting open" : "Upcoming"}
                </Badge>
              </div>
              <p>
                Voting:{" "}
                {new Date(e.voting_start).toLocaleString("en-RW", {
                  timeZone: "Africa/Kigali",
                })}{" "}
                ?{" "}
                {new Date(e.voting_end).toLocaleString("en-RW", {
                  timeZone: "Africa/Kigali",
                })}
              </p>
              <Link
                className="btn btn-primary"
                href={
                  e.status === "open"
                    ? `/account/student/vote/${e.id}`
                    : "/account/student/applications"
                }
              >
                {e.status === "open"
                  ? "Open ballot"
                  : "View candidates and positions"}
              </Link>
            </Card>
          ))
        ) : (
          <Notice>
            No election is currently available for your account. Membership
            activation does not make you eligible for every election.
          </Notice>
        )}
      </section>
      <div className="account-actions">
        <Link className="text-link" href="/account/student/applications">
          Apply for a leadership position
        </Link>
        <Link className="text-link" href="/account/student/help">
          Get help
        </Link>
      </div>
    </main>
  );
}
