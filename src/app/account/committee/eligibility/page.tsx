import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { RegisterPlan } from "@/components/account/register-plan";
export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole([
    "verification_officer",
    "committee_chair",
  ]);
  const [elections, registers] = await Promise.all([
    client
      .from("elections")
      .select("id,title")
      .in("status", ["draft", "prepared"])
      .order("created_at", { ascending: false }),
    client.rpc("list_register_choices"),
  ]);
  if (elections.error || registers.error)
    throw new Error("Election register plans are unavailable.");
  return (
    <RegisterPlan
      elections={elections.data ?? []}
      registers={registers.data ?? []}
    />
  );
}
