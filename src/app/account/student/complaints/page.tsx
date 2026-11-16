import { connection } from "next/server";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { StudentComplaints } from "@/components/account/phase4-complaints";
export default async function Page() {
  await connection();
  const { client } = await requireStudentAccess("/account/student/complaints");
  const { data } = await client
    .from("elections")
    .select("id,title,status")
    .in("status", ["prepared", "open", "closed", "certified"])
    .order("created_at", { ascending: false });
  return <StudentComplaints elections={data ?? []} />;
}
