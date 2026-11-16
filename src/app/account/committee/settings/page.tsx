import { connection } from "next/server";
import Link from "next/link";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { Card, PageHeader } from "@/components/ui";
export default async function Page() {
  await connection();
  const { user } = await requireCommitteeRole([
    "committee_chair",
    "verification_officer",
    "candidate_review_officer",
    "election_administrator",
    "certifying_officer",
  ]);
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="COMMITTEE ACCOUNT"
        title="My account"
        description="Committee authority is managed through the trusted registry, separately from voter activation."
      />
      <Card>
        <p>{user.email}</p>
        <Link className="text-link" href="/account/reset-password">
          Recover or change my password
        </Link>
      </Card>
    </main>
  );
}
