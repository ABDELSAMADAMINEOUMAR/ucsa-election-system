import { connection } from "next/server";
import { AccountForm } from "@/components/account/form";
import { isPublicRegistrationEnabled } from "@/lib/supabase/shared";
export const metadata = { title: "Create an account · UCSA Elections" };
export default async function Page() {
  await connection();
  return <AccountForm mode="register" registrationEnabled={isPublicRegistrationEnabled()} />;
}
