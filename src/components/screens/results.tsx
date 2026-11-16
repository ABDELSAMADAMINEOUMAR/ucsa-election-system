"use client";

import { useState } from "react";
import {
  BarChart3,
  CheckCheck,
  FileText,
  LockKeyhole,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";
import { publishedResults } from "@/demo/data";
import { percent } from "@/lib/utils";
import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  ConfirmationDialog,
  Notice,
  PageHeader,
  Stat,
} from "../ui";

export function ResultTotals() {
  return (
    <div className="stack">
      {publishedResults.map(({ office, entries }) => (
        <Card key={office} className="result-office">
          <CardHeading
            title={office}
            description="200 fictional ballots · Fixed demonstration totals"
          />
          <div className="result-entries">
            {entries.map((entry, i) => (
              <div className="result-entry" key={entry.name}>
                <span className="rank">{String(i + 1).padStart(2, "0")}</span>
                <Avatar name={entry.name} />
                <div className="result-person">
                  <div>
                    <strong>{entry.name}</strong>
                    {i === 0 && <Badge tone="blue">Sample leader</Badge>}
                  </div>
                  <div className={`result-bar bar-${i}`}>
                    <span style={{ width: `${entry.percentage}%` }} />
                  </div>
                </div>
                <span className="result-number">
                  <strong>{entry.percentage}%</strong>
                  <small className="muted">{entry.votes} sample votes</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function PublishedResults() {
  return (
    <>
      <PageHeader
        eyebrow="STUDENT / RESULTS ARCHIVE"
        title="A shared choice. A new chapter."
        description="Explore how a completed election’s published results will be presented."
        action={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={17} />
            Print demo results
          </Button>
        }
      />
      <Notice tone="yellow">
        <strong>
          Fictional demonstration results — not official UCSA results.
        </strong>
        <p>
          This independent sample represents a completed election, not the
          current demo election. The totals are fixed and never reflect ballot
          simulations.
        </p>
      </Notice>
      <section className="results-banner">
        <span className="icon-box blue">
          <CheckCheck size={30} />
        </span>
        <div>
          <p className="eyebrow">
            FICTIONAL COMPLETED ELECTION / SAMPLE ARCHIVE
          </p>
          <h2>UCSA Leadership Election · Sample 2025</h2>
          <p>
            Certification display: completed in this fictional example only.
          </p>
        </div>
        <Badge tone="blue">Demo certification display</Badge>
      </section>
      <div className="stats-grid three">
        <Stat
          label="Sample participation"
          value="66.7%"
          detail="200 of 300 fictional eligible students"
          icon={<Users size={20} />}
        />
        <Stat
          label="Sample ballots per office"
          value="200"
          detail="Fixed data · Not collected votes"
          icon={<BarChart3 size={20} />}
          tone="green"
        />
        <Stat
          label="Leadership offices"
          value="3"
          detail="President, Secretary General, Treasurer"
          icon={<ShieldCheck size={20} />}
          tone="yellow"
        />
      </div>
      <ResultTotals />
      <Notice>
        Real results must remain inaccessible until voting has closed and
        authorized committee certification is complete. Phase 1 does not
        implement these security controls.
      </Notice>
    </>
  );
}

export function ResultsCertification() {
  const demo = useDemo();
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [open, setOpen] = useState(false);
  const allowed = ["Closed", "Pending certification", "Certified"].includes(
    demo.election.status,
  );
  const certified = demo.election.status === "Certified";
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / CERTIFICATION"
        title="Confidence in every step."
        description="Preview the review and certification experience using fictional totals."
        action={<Badge>{demo.election.status}</Badge>}
      />
      <Notice tone="yellow">
        <strong>Certification simulation only.</strong> No real result is
        certified or published. The sample totals below are fixed illustration
        data, never actual ballot outcomes.
      </Notice>
      {allowed ? (
        <>
          <div className="dashboard-columns">
            <Card>
              <CardHeading title="Demo election summary" />
              <dl className="details-list">
                <div>
                  <dt>Election</dt>
                  <dd>{demo.election.title}</dd>
                </div>
                <div>
                  <dt>Workflow stage</dt>
                  <dd>{demo.election.status}</dd>
                </div>
                <div>
                  <dt>Data source</dt>
                  <dd>Independent fictional results fixture</dd>
                </div>
                <div>
                  <dt>Sample participation</dt>
                  <dd>200 of 300 fictional students (66.7%)</dd>
                </div>
              </dl>
              <Notice>
                The results fixture is illustrative and is not derived from the
                current sample voter register or ballot demonstration.
              </Notice>
            </Card>
            <Card>
              <CardHeading
                title="Certification checklist"
                description="A frontend preview, not an integrity verification."
              />
              {[
                "I have reviewed the fictional office-by-office totals.",
                "I understand this does not verify any real election outcome.",
                "I confirm this is a local certification simulation only.",
              ].map((label, i) => (
                <label
                  className="checkbox-label certification-check"
                  key={label}
                >
                  <input
                    type="checkbox"
                    disabled={certified}
                    checked={certified || checks[i]}
                    onChange={(e) =>
                      setChecks((prev) =>
                        prev.map((v, j) => (j === i ? e.target.checked : v)),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
              {certified ? (
                <Notice tone="green">
                  Demo certification preview completed. No official result was
                  created.
                </Notice>
              ) : (
                <Button
                  disabled={
                    !checks.every(Boolean) ||
                    demo.election.status !== "Pending certification"
                  }
                  onClick={() => setOpen(true)}
                >
                  <CheckCheck size={17} />
                  Preview demo certification
                </Button>
              )}
              {demo.election.status === "Closed" && (
                <div className="mt-4">
                  <ButtonLink secondary href="/committee/controls">
                    Advance to pending certification
                  </ButtonLink>
                </div>
              )}
            </Card>
          </div>
          <ResultTotals />
          {certified && (
            <Button onClick={() => window.print()} variant="secondary">
              <Printer size={17} />
              Print fictional certification preview
            </Button>
          )}
        </>
      ) : (
        <Card className="locked-results">
          <span className="icon-box blue">
            <LockKeyhole size={30} />
          </span>
          <h2>Candidate totals are hidden in this stage.</h2>
          <p className="muted">
            Close the demo workflow before exploring fictional results
            certification. During preparation and open voting, this screen shows
            no candidate totals.
          </p>
          <ButtonLink href="/committee/controls">
            Explore election controls
          </ButtonLink>
        </Card>
      )}
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Preview a certified demo state?"
        description="This updates only the local workflow badge. It does not certify or publish real results."
        label="Complete demo certification"
        onConfirm={() => {
          if (
            checks.every(Boolean) &&
            demo.election.status === "Pending certification"
          ) {
            demo.setElection((prev) => ({ ...prev, status: "Certified" }));
            demo.log("Fictional certification preview completed.");
          }
        }}
      />
    </>
  );
}

export function Reports() {
  const demo = useDemo();
  const verified = demo.voters.filter((v) => v.status === "Verified").length;
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / REPORTS"
        title="The picture behind the process."
        description="A print-ready overview of your fictional demo workspace."
        action={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={17} />
            Print demo report
          </Button>
        }
      />
      <Notice tone="yellow">
        <strong>Demonstration report — fictional data only.</strong> This report
        does not establish real participation or certify any election result.
        Use your browser’s print dialog to save a PDF.
      </Notice>
      <Card className="report-cover">
        <div>
          <p className="eyebrow">UCSA / DEMONSTRATION REPORT</p>
          <h2>{demo.election.title}</h2>
          <p className="muted">
            Phase 1 frontend preview · All times in CAT (UTC+2)
          </p>
        </div>
        <FileText size={42} strokeWidth={1.3} />
        <Badge>{demo.election.status}</Badge>
      </Card>
      <div className="stats-grid three">
        <Stat
          label="Fictional register"
          value={demo.voters.length}
          detail="Demo student records"
          icon={<Users size={20} />}
        />
        <Stat
          label="Verification readiness"
          value={`${percent(verified, demo.voters.length)}%`}
          detail={`${verified} fictional students verified`}
          icon={<ShieldCheck size={20} />}
          tone="green"
        />
        <Stat
          label="Candidate applications"
          value={demo.candidates.length}
          detail="Simulated applications in this session"
          icon={<FileText size={20} />}
          tone="yellow"
        />
      </div>
      <div className="dashboard-columns">
        <Card>
          <CardHeading
            title="Candidate application statistics"
            description="Current demo session"
          />
          {["Pending", "Approved", "Rejected"].map((status) => {
            const count = demo.candidates.filter(
              (c) => c.status === status,
            ).length;
            return (
              <div className="report-bar" key={status}>
                <div>
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>
                <span>
                  <i
                    style={{
                      width: `${percent(count, demo.candidates.length)}%`,
                    }}
                  />
                </span>
              </div>
            );
          })}
        </Card>
        <Card>
          <CardHeading
            title="Verification statistics"
            description="Current fictional voter register"
          />
          {["Verified", "Pending", "Ineligible"].map((status) => {
            const count = demo.voters.filter((v) => v.status === status).length;
            return (
              <div className="report-bar" key={status}>
                <div>
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>
                <span>
                  <i
                    style={{ width: `${percent(count, demo.voters.length)}%` }}
                  />
                </span>
              </div>
            );
          })}
        </Card>
      </div>
      <div className="dashboard-columns">
        <Card>
          <CardHeading
            title="Participation illustration"
            description="Independent fictional completed-election fixture"
          />
          <div className="participation-number">
            66.7<span>%</span>
          </div>
          <p className="muted">
            200 of 300 fictional students in the sample archive.
          </p>
          <p className="muted small mt-4">
            There is no live voting participation in Phase 1. The ballot UI
            never changes this number.
          </p>
        </Card>
        <Card>
          <CardHeading
            title="Complaints overview"
            description="Demo community concerns"
          />
          <dl className="details-list">
            {["New", "Under review", "Resolved"].map((status) => (
              <div key={status}>
                <dt>{status}</dt>
                <dd>
                  {demo.complaints.filter((c) => c.status === status).length}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <Card className="report-notes">
        <CardHeading title="Scope and limitations" />
        <p className="prose">
          This document is an interface demonstration with fictional records.
          Configuration, reviews, and certification states are memory-only. No
          real eligibility, vote recording, audit integrity, or authentication
          is implemented. Independent security and election-process review is
          required before real use.
        </p>
      </Card>
    </>
  );
}
