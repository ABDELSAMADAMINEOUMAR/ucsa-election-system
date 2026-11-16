import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { isSyntheticVotingEnabled } from "@/lib/voting-policy";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { SecureBallot } from "@/components/account/secure-ballot";

export default async function Page({
  params,
}: PageProps<"/account/student/vote/[electionId]">) {
  await connection();
  const { client } = await requireStudentAccess("/account/student/vote");
  if (!isSyntheticVotingEnabled(process.env.UCSA_DEPLOYMENT_MODE, process.env.UCSA_SYNTHETIC_VOTING_ENABLED)) redirect("/account/student/vote");
  const { electionId } = await params;
  const { data } = await client
    .from("elections")
    .select("id")
    .eq("id", electionId)
    .maybeSingle();
  if (!data) notFound();
  return <SecureBallot electionId={electionId} />;
}
