import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { PublishedResults } from "@/components/account/published-results";
export default async function Page({
  params,
}: PageProps<"/account/committee/published/[electionId]">) {
  await connection();
  const { client } = await requireCommitteeRole([
    "certifying_officer",
    "committee_chair",
  ]);
  return (
    <PublishedResults client={client} electionId={(await params).electionId} />
  );
}
