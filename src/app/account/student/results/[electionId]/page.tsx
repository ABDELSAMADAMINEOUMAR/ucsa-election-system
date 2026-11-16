import { connection } from "next/server";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { PublishedResults } from "@/components/account/published-results";
export default async function Page({
  params,
}: PageProps<"/account/student/results/[electionId]">) {
  await connection();
  const { client } = await requireStudentAccess();
  return (
    <PublishedResults client={client} electionId={(await params).electionId} />
  );
}
