import { connection } from "next/server";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { MembershipAdministration } from "@/components/account/membership-administration";
import { CorrectionForm } from "@/components/account/correction-form";
import { SupportReview } from "@/components/account/support-review";
export default async function Administration() {
  await connection();
  const { client, user } = await requireAuthenticatedUser();
  const roles = await client
    .from("committee_members")
    .select("role,election_id")
    .eq("user_id", user.id);
  if (!roles.data?.length) redirect("/account");
  const global = roles.data
    .filter((r) => r.election_id === null)
    .map((r) => r.role);
  const chair = global.includes("committee_chair");
  const review = chair || global.includes("verification_officer");
  const support = review
    ? await client
        .from("membership_support")
        .select("id,email,message,status,response")
        .order("created_at", { ascending: false })
        .limit(100)
    : null;
  const choices = review ? await client.rpc("list_register_choices") : null;
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="COMMITTEE"
        title="Administration"
        description="People, access, support and accountable records."
      />
      <Card className="stack">
        {chair && (
          <Link className="text-link" href="/account/committee/members">
            Committee members and role assignments
          </Link>
        )}
        {roles.data.some((r) =>
          ["committee_chair", "election_administrator"].includes(r.role),
        ) && (
          <Link className="text-link" href="/account/committee/audit">
            Audit history
          </Link>
        )}
        <Link
          className="text-link"
          href="/account/committee/elections?archive=1"
        >
          Historical local election records
        </Link>
        <Link className="text-link" href="/account/committee/settings">
          My account settings
        </Link>
        {review && (
          <Link className="text-link" href="/account/committee/verification">
            Historical identity review records
          </Link>
        )}
      </Card>
      {review && (
        <>
          <SupportReview items={support?.data ?? []} />
          <CorrectionForm registers={choices?.data ?? []} />
        </>
      )}{" "}
      {chair && <MembershipAdministration />}
    </main>
  );
}
