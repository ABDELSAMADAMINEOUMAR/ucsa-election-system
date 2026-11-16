import { connection } from "next/server";
import type { ReactNode } from "react";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { WorkspaceShell } from "@/components/account/workspace-shell";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const { client, user } = await requireStudentAccess("/account/student");
  const { data } = await client.rpc("get_my_membership");
  return (
    <WorkspaceShell
      roles={[]}
      name={data?.name || "Student"}
      email={user.email ?? ""}
    >
      {children}
    </WorkspaceShell>
  );
}
