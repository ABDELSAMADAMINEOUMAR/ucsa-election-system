import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import {
  MemberTable,
  type MemberView,
} from "@/components/account/member-table";
export default async function Page() {
  await connection();
  const { client, user } = await requireCommitteeRole(["committee_chair"]);
  const global = await client.rpc("has_committee_role", {
    allowed: ["committee_chair"],
  });
  if (global.error || global.data !== true) redirect("/account");
  const [members, elections] = await Promise.all([
    client
      .from("committee_members")
      .select(
        "user_id,role,election_id,created_at,profiles!committee_members_user_id_fkey(full_name,email),elections(title)",
      )
      .order("created_at", { ascending: false }),
    client
      .from("elections")
      .select("id,title")
      .order("created_at", { ascending: false }),
  ]);
  if (members.error || elections.error)
    throw new Error("The committee registry is unavailable.");
  return (
    <MemberTable
      initial={(members.data ?? []) as MemberView[]}
      elections={elections.data ?? []}
      currentUserId={user.id}
    />
  );
}
