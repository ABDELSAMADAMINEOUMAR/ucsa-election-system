import Link from "next/link";
import { connection } from "next/server";
import { requireStudentAccess } from "@/lib/supabase/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
export default async function Settings() {
  await connection();
  const { client } = await requireStudentAccess("/account/student/settings");
  const { data: membership, error } = await client.rpc("get_my_membership");
  const data = {
    full_name: membership?.name,
    email: membership?.email,
    registration_number: membership?.registrationNumber,
    verification_status: "Activated",
  };
  if (error) throw new Error("Account details unavailable.");
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="PERSONAL ACCOUNT"
        title="Account settings"
        description="Your private account information and secure password recovery."
      />
      <Card>
        <dl className="details-list">
          <div>
            <dt>Name</dt>
            <dd>{data.full_name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{data.email}</dd>
          </div>
          <div>
            <dt>Registration</dt>
            <dd>{data.registration_number || "Not yet verified"}</dd>
          </div>
          <div>
            <dt>Identity status</dt>
            <dd>
              <Badge>{data.verification_status}</Badge>
            </dd>
          </div>
        </dl>
        <Link className="text-link" href="/account/reset-password">
          Request a secure password reset
        </Link>
      </Card>
    </main>
  );
}
