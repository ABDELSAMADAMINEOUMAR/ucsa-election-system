import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { ElectionVotingControls } from "@/components/account/voting-controls";

export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole(["election_administrator", "committee_chair"]);
  const { data, error } = await client.from("elections").select("id,title,status,voting_start,voting_end,election_offices!election_offices_election_id_fkey(id,title,is_active),election_classifications!inner(classification)").order("created_at", { ascending: false });
  if (error) throw new Error("Election controls are unavailable.");
  const elections = await Promise.all((data ?? []).map(async (election) => {
    if (election.status !== "closed") return { ...election, participation: null };
    const { data: summary } = await client.rpc("get_election_participation_summary", { election_id_input: election.id });
    return { ...election, participation: summary?.[0] ?? null };
  }));
  return <ElectionVotingControls elections={elections as never}/>;
}
