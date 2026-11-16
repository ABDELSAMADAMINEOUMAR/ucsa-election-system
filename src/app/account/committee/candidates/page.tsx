import { connection } from "next/server";
import { requireCommitteeRole } from "@/lib/supabase/auth";
import { SlateForm } from "@/components/account/slate-form";
import { CandidateTable } from "@/components/account/candidate-table";

export default async function Page() {
  await connection();
  const { client } = await requireCommitteeRole([
    "candidate_review_officer",
    "committee_chair",
  ]);
  const { data, error } = await client
    .from("candidate_review_queue")
    .select(
      "id,election_id,office_id,user_id,full_name,biography,manifesto,status,submitted_at,office_title,election_title",
    )
    .order("submitted_at", { ascending: false });
  if (error) throw new Error("The candidate review queue is unavailable.");
  const docs = data?.length
    ? await client
        .from("candidate_application_documents")
        .select("application_id,storage_path")
        .in(
          "application_id",
          data.map((row) => row.id),
        )
    : { data: [], error: null };
  if (docs.error)
    throw new Error("Private candidate documents are unavailable.");
  const decisions = data?.length
    ? await client
        .from("candidate_review_decisions")
        .select("application_id,decision,reason,decided_at")
        .in(
          "application_id",
          data.map((row) => row.id),
        )
        .order("decided_at", { ascending: false })
    : { data: [], error: null };
  if (decisions.error)
    throw new Error("Candidate decision history is unavailable.");
  const initial = await Promise.all(
    (data ?? []).map(async (application) => {
      const doc = docs.data?.find(
        (item) => item.application_id === application.id,
      );
      if (!doc)
        return {
          ...application,
          photoUrl: null,
          history:
            decisions.data?.filter(
              (item) => item.application_id === application.id,
            ) ?? [],
        };
      const { data: url } = await client.storage
        .from("candidate-private")
        .createSignedUrl(doc.storage_path, 60);
      return {
        ...application,
        photoUrl: url?.signedUrl ?? null,
        history:
          decisions.data?.filter(
            (item) => item.application_id === application.id,
          ) ?? [],
      };
    }),
  );
  const elections = await client
    .from("elections")
    .select("id,title")
    .in("status", ["draft", "prepared"])
    .order("created_at", { ascending: false });
  return (
    <>
      <CandidateTable initial={initial as never} />
      <div className="account-workspace">
        <SlateForm elections={elections.data ?? []} />
      </div>
    </>
  );
}
