"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Logo, Notice, PageHeader } from "@/components/ui";

type Election = {
  id: string;
  title: string;
  status: string;
  voting_end: string;
};
type Workspace = {
  election: { status: string; title: string; votingEnd: string };
  policy: {
    required_approvals: number;
    policy_reference: string;
    complaints_required: boolean;
    allow_reopen: boolean;
  } | null;
  unresolvedComplaints: number;
  reconciliation: {
    id: string;
    revision: number;
    status: string;
    ballot_total: number;
    participation_total: number;
    discrepancy_count: number;
    offices: {
      office_id: string;
      ballot_count: number;
      participation_count: number;
      invalid_count: number;
    }[];
    candidates: {
      office_id: string;
      candidate_name: string;
      vote_count: number;
      percentage: number;
      tied_at_top: boolean;
    }[];
  } | null;
  approvals: {
    id: string;
    officerId: string;
    decision: string;
    reason: string;
  }[];
  certifications: {
    id: string;
    reference: string;
    certifiedAt: string;
    snapshot: {
      offices: {
        officeId: string;
        officeTitle: string;
        candidates: {
          name: string;
          votes: number;
          percentage: number;
          tiedAtTop: boolean;
        }[];
      }[];
    };
  }[];
  publications: { id: string; version: number; publishedAt: string }[];
};

export function CertificationWorkspace({
  elections,
  selectedId,
  workspace,
  roles,
}: {
  elections: Election[];
  selectedId: string;
  workspace: Workspace | null;
  roles: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const chair = roles.includes("committee_chair");
  const canReview = chair || roles.includes("certifying_officer");
  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/account/elections/${selectedId}/certification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action unavailable.");
      setMessage("Action completed and recorded.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function configure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({
      action: "configure_policy",
      requiredApprovals: Number(form.get("approvals")),
      policyReference: form.get("policyReference"),
      complaintsRequired: form.get("complaintsRequired") === "on",
      allowReopen: form.get("allowReopen") === "on",
    });
  }
  async function correction(
    event: React.FormEvent<HTMLFormElement>,
    certificationId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({
      action: "correction",
      certificationId,
      reason: form.get("reason"),
      note: form.get("note"),
    });
  }
  const rec = workspace?.reconciliation;
  const cert = workspace?.certifications?.[0];
  const latestApproval =
    rec &&
    workspace?.approvals?.filter((a) => a.decision === "approved").length >=
      (workspace.policy?.required_approvals ?? 99);
  return (
    <main className="container stack account-workspace">
      <Logo />
      <PageHeader
        eyebrow="CONFIDENTIAL · AUTHORIZED OFFICERS"
        title="Results and certification"
        description="Reconcile database totals, review configurable prerequisites, record approvals, and publish certified results."
        back="/account/committee"
      />
      <div className="toolbar">
        <label>
          Election
          <select
            value={selectedId}
            onChange={(e) =>
              router.push(
                `/account/committee/certification?election=${e.target.value}`,
              )
            }
          >
            {elections.map((e) => (
              <option value={e.id} key={e.id}>
                {e.title} · {e.status}
              </option>
            ))}
          </select>
        </label>
        <span className="badge badge-blue">
          {workspace?.election.status ?? "Unavailable"}
        </span>
      </div>
      <Link href="/account/committee/complaints" className="text-link">
        Review election complaints
      </Link>
      <Link href="/account/committee/voting/results" className="text-link">
        Restricted post-close tally
      </Link>
      <Notice tone="yellow">
        This administrative workflow is not an election security certification.
        Database operators may still correlate or alter records. Independent
        security review and authoritative UCSA rules are required before real
        use.
      </Notice>
      {message && <Notice>{message}</Notice>}
      {!workspace ? (
        <Card>
          <h2>Workspace unavailable</h2>
          <p>
            Reconciliation requires a closed election after its scheduled end.
          </p>
        </Card>
      ) : (
        <>
          <Card className="stack">
            <h2>Readiness</h2>
            <div className="workflow-check">
              <span>Voting closed and scheduled end passed</span>
              <strong>
                {workspace.election.status === "closed" ||
                workspace.election.status === "certified"
                  ? "Ready"
                  : "Blocked"}
              </strong>
            </div>
            <div className="workflow-check">
              <span>Latest reconciliation</span>
              <strong>{rec?.status ?? "Not started"}</strong>
            </div>
            <div className="workflow-check">
              <span>Unresolved complaints</span>
              <strong>{workspace.unresolvedComplaints}</strong>
            </div>
            <div className="workflow-check">
              <span>Required policy reference</span>
              <strong>
                {workspace.policy?.policy_reference ?? "Not configured"}
              </strong>
            </div>
            {rec && (
              <p>
                Revision {rec.revision} · {rec.ballot_total} ballots ·{" "}
                {rec.participation_total} participation records · discrepancies{" "}
                {rec.discrepancy_count}
              </p>
            )}
            {canReview && workspace.election.status === "closed" && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => action({ action: "reconcile" })}
              >
                Run reconciliation
              </button>
            )}
          </Card>
          {!workspace.policy &&
            chair &&
            workspace.election.status === "closed" && (
              <Card className="stack">
                <h2>Certification policy</h2>
                <Notice tone="yellow">
                  Enter the authoritative UCSA policy reference. Approval count
                  is configurable because no approved quorum rule is supplied.
                </Notice>
                <form className="stack" onSubmit={configure}>
                  <label>
                    Required distinct approvals
                    <input
                      name="approvals"
                      type="number"
                      min="1"
                      max="5"
                      defaultValue="1"
                      required
                    />
                  </label>
                  <label>
                    UCSA policy reference
                    <input
                      name="policyReference"
                      minLength={5}
                      maxLength={500}
                      required
                      placeholder="Approved policy name and clause"
                    />
                  </label>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      name="complaintsRequired"
                      defaultChecked
                    />{" "}
                    Require all complaints resolved before certification
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="allowReopen" /> Allow chair to
                    reopen resolved/rejected complaints
                  </label>
                  <button className="btn btn-secondary" disabled={busy}>
                    Save policy
                  </button>
                </form>
              </Card>
            )}
          {workspace.policy && (
            <Card className="stack">
              <h2>Reconciliation detail</h2>
              {rec?.offices.map((office) => (
                <section className="stack" key={office.office_id}>
                  <h3>Office totals</h3>
                  <p>
                    {office.ballot_count} ballots · {office.participation_count}{" "}
                    participation · {office.invalid_count} invalid ·{" "}
                    {office.ballot_count === office.participation_count &&
                    office.invalid_count === 0
                      ? "Reconciled"
                      : "Discrepancy"}
                  </p>
                  {rec.candidates
                    .filter((c) => c.office_id === office.office_id)
                    .map((candidate) => (
                      <div
                        className="secure-list-row"
                        key={candidate.candidate_name}
                      >
                        <span>
                          {candidate.candidate_name}
                          {candidate.tied_at_top ? " · tied at top" : ""}
                        </span>
                        <strong>
                          {candidate.vote_count} ·{" "}
                          {Number(candidate.percentage).toFixed(2)}%
                        </strong>
                      </div>
                    ))}
                </section>
              ))}
              {!rec && <p>No reconciliation has been run.</p>}
              {rec?.status === "passed" && (
                <p>
                  Approvals:{" "}
                  {
                    workspace.approvals.filter((a) => a.decision === "approved")
                      .length
                  }{" "}
                  / {workspace.policy.required_approvals}
                </p>
              )}
              {canReview && rec?.status === "passed" && !cert && (
                <div className="toolbar">
                  <button
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() =>
                      action({ action: "approve", reconciliationId: rec.id })
                    }
                  >
                    Approve snapshot
                  </button>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => {
                      const reason = window.prompt("Reason for rejection");
                      if (reason)
                        void action({
                          action: "reject",
                          reconciliationId: rec.id,
                          reason,
                        });
                    }}
                  >
                    Reject snapshot
                  </button>
                  {latestApproval && (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        action({ action: "certify", reconciliationId: rec.id })
                      }
                    >
                      Certify results
                    </button>
                  )}
                </div>
              )}
            </Card>
          )}
          {workspace.certifications.map((item) => (
            <Card className="stack" key={item.id}>
              <h2>Certified snapshot</h2>
              <Notice tone="green">
                {item.reference} · {new Date(item.certifiedAt).toLocaleString()}
              </Notice>
              <p>
                Checksum: stored SHA-256 detects accidental differences only; it
                does not protect against a privileged database operator.
              </p>
              {workspace.publications.length ? (
                <p>
                  Publication version {workspace.publications[0].version} ·{" "}
                  {new Date(
                    workspace.publications[0].publishedAt,
                  ).toLocaleString()}
                </p>
              ) : (
                <p>Not publicly published.</p>
              )}
              <div className="toolbar">
                {workspace.publications.length > 0 && (
                  <Link
                    className="btn btn-primary"
                    href={`/account/committee/published/${selectedId}`}
                  >
                    View published rehearsal results
                  </Link>
                )}
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/election-summary`}
                >
                  Election summary PDF
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/certified-results`}
                >
                  Certified results PDF
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/candidate-results`}
                >
                  Candidate results PDF
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/participation-summary`}
                >
                  Participation PDF
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/complaints-summary`}
                >
                  Complaints summary PDF
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/api/account/elections/${selectedId}/reports/certification-record`}
                >
                  Certification record PDF
                </Link>
                {chair && !workspace.publications.length && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      action({ action: "publish", certificationId: item.id })
                    }
                  >
                    Publish results
                  </button>
                )}
              </div>
              {chair && (
                <details>
                  <summary>Record an auditable correction event</summary>
                  <form
                    className="stack"
                    onSubmit={(event) => correction(event, item.id)}
                  >
                    <label>
                      Reason
                      <textarea
                        name="reason"
                        minLength={10}
                        maxLength={2000}
                        required
                      />
                    </label>
                    <label>
                      Proposed correction note
                      <textarea
                        name="note"
                        minLength={5}
                        maxLength={2000}
                        required
                      />
                    </label>
                    <button className="btn btn-secondary" disabled={busy}>
                      Record correction
                    </button>
                  </form>
                </details>
              )}
              <p className="small muted">
                Correction events do not overwrite this immutable snapshot.
                Corrections require independently approved policy and process.
              </p>
            </Card>
          ))}
        </>
      )}
    </main>
  );
}
