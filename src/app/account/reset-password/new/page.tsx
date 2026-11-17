import { AccountForm } from "@/components/account/form";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const metadata = { title: "Choose a new password · UCSA Elections" };
export default async function Page() {
  await connection();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    redirect("/account/reset-password?notice=link-invalid");
  return <AccountForm mode="new-password" />;
}
