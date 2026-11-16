import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";

export async function getAuthenticatedUser() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const { data: active, error: sessionError } =
    await client.rpc("is_active_session");
  if (sessionError || active !== true) return null;
  return { client, user: data.user };
}

export async function requireAuthenticatedUser(returnTo = "/account") {
  const session = await getAuthenticatedUser();
  if (!session)
    redirect(`/account/sign-in?next=${encodeURIComponent(returnTo)}`);
  return session;
}

export async function requireStudentAccess(returnTo = "/account/student") {
  const session = await requireAuthenticatedUser(returnTo);
  const access = await session.client.rpc("has_student_access");
  if (access.error || access.data !== true) redirect("/account/activate");
  return session;
}

export async function hasCommitteeRole(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  roles: string[],
) {
  const { data, error } = await client
    .from("committee_members")
    .select("role")
    .in("role", roles)
    .limit(1);
  if (error) return false;
  return Boolean(data?.length);
}

export async function requireCommitteeRole(roles: string[]) {
  const session = await requireAuthenticatedUser("/account/committee");
  if (!(await hasCommitteeRole(session.client, roles))) redirect("/account");
  return session;
}
