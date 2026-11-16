import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/account/workspace-shell";
import { connection } from "next/server";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import {
  requireAuthenticatedUser,
  hasCommitteeRole,
} from "@/lib/supabase/auth";

export default async function AccountHome() {
  await connection();
  const { client, user } = await requireAuthenticatedUser();
  const [
    { data: profile },
    verificationOfficer,
    candidateOfficer,
    admin,
    certifier,
    chair,
  ] = await Promise.all([
    client
      .from("profiles")
      .select("full_name,verification_status")
      .eq("id", user.id)
      .maybeSingle(),
    hasCommitteeRole(client, ["verification_officer"]),
    hasCommitteeRole(client, ["candidate_review_officer"]),
    hasCommitteeRole(client, ["election_administrator"]),
    hasCommitteeRole(client, ["certifying_officer"]),
    hasCommitteeRole(client, ["committee_chair"]),
  ]);
  const isCommittee =
    verificationOfficer || candidateOfficer || admin || certifier || chair;
  if (!isCommittee) {
    const access = await client.rpc("has_student_access");
    redirect(access.data === true ? "/account/student" : "/account/activate");
  }
  const memberships = await client
    .from("committee_members")
    .select("role,election_id")
    .eq("user_id", user.id);
  if (memberships.error)
    throw new Error("Account authorization is unavailable.");
  return (
    <WorkspaceShell
      committee={isCommittee}
      globalRoles={memberships.data
        .filter((item) => item.election_id === null)
        .map((item) => item.role)}
      roles={[
        chair && "committee_chair",
        verificationOfficer && "verification_officer",
        candidateOfficer && "candidate_review_officer",
        admin && "election_administrator",
        certifier && "certifying_officer",
      ].filter((role): role is string => Boolean(role))}
      name={profile?.full_name || "UCSA account"}
      email={user.email ?? ""}
    >
      <main className="container stack account-workspace">
        <PageHeader
          eyebrow="UCSA / ACCOUNT"
          title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.`}
          description="Your authenticated workspace is separate from the Phase 1 simulation."
        />
        <div className="account-grid">
          <Card>
            <GraduationCap size={28} />
            <h2>Student workspace</h2>
            <p>
              Review your identity verification and your own election
              applications.
            </p>
            <Link className="text-link" href="/account/activate">
              Activate / open student account <ArrowRight size={16} />
            </Link>
            <p className="muted small">
              Identity: {profile?.verification_status ?? "pending"} · No voting
              is enabled
            </p>
          </Card>
          {(isCommittee || certifier) && (
            <Card>
              <ShieldCheck size={28} />
              <h2>Committee workspace</h2>
              <p>
                Review records only for the duties assigned to your account.
              </p>
              <Link className="text-link" href="/account/committee">
                Open authorized tools <ArrowRight size={16} />
              </Link>
              <p className="muted small">
                {[
                  verificationOfficer && "Verification",
                  candidateOfficer && "Candidate review",
                  admin && "Election administration",
                  certifier && "Certification",
                  chair && "Committee chair",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Card>
          )}
          <Card>
            <ClipboardList size={28} />
            <h2>Candidate applications</h2>
            <p>
              Submit an application only after student verification and election
              eligibility are approved.
            </p>
            <Link className="text-link" href="/account/student/applications">
              View your applications <ArrowRight size={16} />
            </Link>
          </Card>
        </div>
        {!isCommittee && (
          <p className="muted small">
            <UsersRound size={15} /> Committee tools appear only when the
            trusted committee registry authorizes your account. Public
            registration can never grant these roles.
          </p>
        )}
      </main>
    </WorkspaceShell>
  );
}
