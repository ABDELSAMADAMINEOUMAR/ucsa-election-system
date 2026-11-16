import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { OfficialRegister } from "@/components/account/official-register";
export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole([
    "committee_chair",
    "verification_officer",
  ]);
  const globalReviewer = await client.rpc("has_committee_role", {
    allowed: ["committee_chair", "verification_officer"],
  });
  if (globalReviewer.error)
    throw new Error("Register authorization is unavailable.");
  if (globalReviewer.data !== true) redirect("/account");
  const { data, error } = await client
    .from("official_registers")
    .select("id,title,status,file_name,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Register versions are unavailable.");
  const [choices, chair] = await Promise.all([
    client.rpc("list_register_choices"),
    client.rpc("has_committee_role", { allowed: ["committee_chair"] }),
  ]);
  return (
    <OfficialRegister
      registers={data ?? []}
      hasApproved={Boolean(choices.data?.length)}
      chair={chair.data === true}
    />
  );
}
