import Link from "next/link";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";

export type Metric = { label: string; value: number | null };
export function CommitteeOverview({
  metrics,
  elections,
  hasErrors,
  verification,
  candidates,
}: {
  metrics: Metric[];
  elections: { id: string; title: string; status: string }[];
  hasErrors: boolean;
  verification: boolean;
  candidates: boolean;
}) {
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="COMMITTEE ADMINISTRATION"
        title="Dashboard"
        description="An overview of the records and actions available to your committee account."
      />
      {hasErrors && (
        <Notice tone="yellow">
          Some records could not be loaded. Unavailable counts are shown as
          “Unavailable”, never as zero. Refresh or open the relevant workspace.
        </Notice>
      )}
      <div className="metric-grid">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {metric.value === null
                ? "Unavailable"
                : metric.value.toLocaleString()}
            </strong>
          </div>
        ))}
      </div>
      <div className="account-grid">
        <Card>
          <div className="workspace-section-heading">
            <h2>Committee actions</h2>
            <Badge>Authorized tasks</Badge>
          </div>
          <div className="record-list">
            {verification && (
              <>
                <Link href="/account/committee/verification">
                  <span>
                    <strong>Review student identities</strong>
                    <small className="muted">
                      {" "}
                      Exact roster matching and bulk decisions
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
                <Link href="/account/committee/eligibility">
                  <span>Review election-specific eligibility</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </>
            )}
            {candidates && (
              <Link href="/account/committee/candidates">
                <span>Review candidate applications</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            <Link href="/account">
              <span>Account information and workspace access</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="muted small">
            All actions are checked against your live session, role and election
            scope.
          </p>
        </Card>
        <Card>
          <div className="workspace-section-heading">
            <h2>Recent visible elections</h2>
            <Badge>{elections.length} shown</Badge>
          </div>
          {elections.length ? (
            <div className="record-list">
              {elections.map((election) => (
                <div className="secure-list-row" key={election.id}>
                  <strong>{election.title}</strong>
                  <Badge tone={election.status === "open" ? "green" : "blue"}>
                    {election.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No elections are visible to this account.</p>
          )}
          <Notice>
            Local test records may appear here. Real election use remains
            unapproved; displayed election states do not constitute release
            approval.
          </Notice>
        </Card>
      </div>
    </main>
  );
}
