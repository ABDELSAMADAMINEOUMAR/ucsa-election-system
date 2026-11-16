import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { WorkspaceShell } from "@/components/account/workspace-shell";

export default async function CommitteeLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const { client, user } = await requireAuthenticatedUser("/account/committee");
  const roles = [
    "committee_chair",
    "verification_officer",
    "candidate_review_officer",
    "election_administrator",
    "certifying_officer",
  ];
  const membership = await client
    .from("committee_members")
    .select("role,election_id")
    .eq("user_id", user.id);
  if (membership.error)
    throw new Error("Committee authorization is unavailable.");
  const current = roles.filter((role) =>
    membership.data.some((item) => item.role === role),
  );
  const globalRoles = roles.filter((role) =>
    membership.data.some(
      (item) => item.role === role && item.election_id === null,
    ),
  );
  if (!current.length) redirect("/account");
  const { data } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  return (
    <WorkspaceShell
      committee
      roles={current}
      globalRoles={globalRoles}
      name={data?.full_name || "Committee member"}
      email={user.email ?? ""}
    >
      {children}
    </WorkspaceShell>
  );
}
