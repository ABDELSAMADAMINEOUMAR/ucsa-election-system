import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { ActivationForm } from "@/components/account/activation";
import { SecureSignOut } from "@/components/account/form";
import { Logo, Notice, PageHeader } from "@/components/ui";
export default async function Activate() {
  await connection();
  const { client, user } = await requireAuthenticatedUser("/account/activate");
  const active = await client.rpc("has_student_access");
  if (active.data === true) redirect("/account/student");
  return (
    <main className="container stack account-workspace">
      <Logo />
      <PageHeader
        eyebrow="UCSA ACCOUNT"
        title="Complete your account activation"
        description={`Email confirmed: ${user.email ?? "Your account"}`}
      />
      <Notice tone="yellow">
        Local rehearsal environment. Real student registration and elections
        remain disabled.
      </Notice>
      <ActivationForm
        initial={
          typeof user.user_metadata?.requested_registration === "string"
            ? user.user_metadata.requested_registration
            : ""
        }
      />
      <Link className="text-link" href="/account">
        Account overview / Committee access
      </Link>
      <SecureSignOut />
    </main>
  );
}
