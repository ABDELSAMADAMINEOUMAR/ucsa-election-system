import { AccountForm } from "@/components/account/form";
import { connection } from "next/server";
import { isPublicRegistrationEnabled } from "@/lib/supabase/shared";
export const metadata = { title: "Secure sign in · UCSA Elections" };
export default async function Page() {
  await connection();
  return (
    <AccountForm
      mode="sign-in"
      registrationEnabled={isPublicRegistrationEnabled()}
    />
  );
}
