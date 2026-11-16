import { connection } from "next/server";
import Link from "next/link";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { Card, PageHeader } from "@/components/ui";
import { ElectionAdmin } from "@/components/account/workspaces";
import { ElectionWizard } from "@/components/account/election-wizard";
export default async function Page({
  searchParams,
}: PageProps<"/account/committee/elections">) {
  await connection();
  const archive = (await searchParams).archive === "1";
  const { client, user } = await requireCommitteeRole([
    "election_administrator",
    "verification_officer",
    "committee_chair",
  ]);
  if (archive) {
    const historical = await client
      .from("elections")
      .select("id,title,status")
      .order("created_at", { ascending: false })
      .limit(100);
    return (
      <main className="account-workspace stack">
        <PageHeader
          eyebrow="ARCHIVE"
          title="Historical local records"
          description="Preserved records. Listing here does not classify or authorize them for an election."
        />
        {historical.data?.map((e) => (
          <Card key={e.id}>
            <h2>{e.title}</h2>
            <p>{e.status}</p>
          </Card>
        ))}
      </main>
    );
  }
  const [elections, registers, chair, creator] = await Promise.all([
    client
      .from("elections")
      .select(
        "id,title,description,status,nominations_start,nominations_end,voting_start,voting_end,election_classifications!inner(classification),election_offices!election_offices_election_id_fkey(id,title,display_order)",
      )
      .order("created_at", { ascending: false }),
    client.rpc("list_register_choices"),
    client.rpc("has_committee_role", { allowed: ["committee_chair"] }),
    client.rpc("has_committee_role", {
      allowed: ["election_administrator", "committee_chair"],
    }),
  ]);
  if (elections.error)
    throw new Error("Election configuration is unavailable.");
  const memberships = await client
    .from("committee_members")
    .select("role,election_id")
    .eq("user_id", user.id);
  const prepareIds = (elections.data ?? [])
    .filter((e) =>
      memberships.data?.some(
        (m) =>
          ["committee_chair", "election_administrator"].includes(m.role) &&
          (m.election_id === null || m.election_id === e.id),
      ),
    )
    .map((e) => e.id);
  return (
    <>
      <div className="account-workspace stack">
        <div className="account-actions">
          <Link className="text-link" href="/account/committee/eligibility">
            Register and election eligibility
          </Link>
          <Link className="text-link" href="/account/committee/voting">
            Authorized voting controls
          </Link>
        </div>
        {creator.data === true && (
          <ElectionWizard
            registers={registers.data ?? []}
            chair={chair.data === true}
          />
        )}
      </div>
      <ElectionAdmin
        initial={(elections.data ?? []) as never}
        listOnly
        chair={chair.data === true}
        prepareIds={prepareIds}
      />
    </>
  );
}
