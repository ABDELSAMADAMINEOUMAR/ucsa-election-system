import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import {
  BulkVerificationTable,
  type VerificationPage,
} from "@/components/account/bulk-verification";
export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole([
    "verification_officer",
    "committee_chair",
  ]);
  const { data, error } = await client.rpc("review_verification_queue", {
    page_input: 1,
    size_input: 25,
    search_input: "",
    status_input: "pending",
  });
  if (error)
    throw new Error(
      "The verification queue is unavailable. Check the local administration migration.",
    );
  return <BulkVerificationTable initial={data as VerificationPage} />;
}
