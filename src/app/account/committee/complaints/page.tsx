import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { CommitteeComplaints } from "@/components/account/phase4-complaints";
export default async function Page() {
  await connection(); await requireCommitteeRole(["certifying_officer", "committee_chair"]);
  return <CommitteeComplaints/>;
}
