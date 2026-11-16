import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { CertificationWorkspace } from "@/components/account/phase4-certification";
export default async function Page({ searchParams }: PageProps<"/account/committee/certification">) {
  await connection(); const { client, user } = await requireCommitteeRole(["certifying_officer", "committee_chair"]);
  const params = await searchParams; const { data } = await client.from("elections").select("id,title,status,voting_end").in("status", ["closed", "certified"]).order("voting_end", { ascending: false });
  const elections = data ?? []; const selectedId = elections.some((e) => e.id === params.election) ? params.election : elections[0]?.id;
  const roleQuery = await client.from("committee_members").select("role").eq("user_id", user.id).or(`election_id.is.null,election_id.eq.${selectedId}`);
  const roles = (roleQuery.data ?? []).map((item) => item.role as string);
  if (!selectedId) return <main className="container stack account-workspace"><h1>Results and certification</h1><p>There are no closed elections available for reconciliation.</p></main>;
  const { data: workspace, error } = await client.rpc("get_certification_workspace", { election_id_input: selectedId });
  return <CertificationWorkspace elections={elections} selectedId={selectedId} workspace={error ? null : workspace} roles={roles}/>;
}
