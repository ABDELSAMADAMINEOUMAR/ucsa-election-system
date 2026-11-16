"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GraduationCap,
  Mail,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  ConfirmationDialog,
  EmptyState,
  FilterControl,
  Notice,
  PageHeader,
  SearchField,
} from "../ui";
import { matches } from "@/lib/utils";
import { offices } from "@/demo/data";
import type { Candidate } from "@/types";

export function CandidateCard({
  candidate,
  committee = false,
}: {
  candidate: Candidate;
  committee?: boolean;
}) {
  return (
    <Card className="candidate-card">
      <div className="candidate-card-top">
        <Avatar name={candidate.name} photo={candidate.photo} large />
        <Badge>{candidate.status}</Badge>
      </div>
      <span className="eyebrow">{candidate.office}</span>
      <h2>{candidate.name}</h2>
      <p className="muted">{candidate.bio.slice(0, 118)}…</p>
      <div className="candidate-card-footer">
        <span className="muted small">
          <GraduationCap size={16} />
          UNILAK · Demo profile
        </span>
        <Link
          className="text-link"
          href={`/${committee ? "committee" : "student"}/candidates/${candidate.id}`}
        >
          {committee ? "Review" : "View profile"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </Card>
  );
}

export function CandidateDirectory({
  committee = false,
}: {
  committee?: boolean;
}) {
  const { candidates } = useDemo();
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("All offices");
  const [status, setStatus] = useState("All statuses");
  const visible = candidates.filter(
    (c) =>
      (committee || c.status === "Approved") &&
      matches(query, c.name, c.registration) &&
      (office === "All offices" || c.office === office) &&
      (status === "All statuses" || c.status === status),
  );
  return (
    <>
      <PageHeader
        eyebrow={committee ? "COMMITTEE / APPLICATIONS" : "STUDENT LEADERSHIP"}
        title={committee ? "Candidate review" : "Meet the candidates"}
        description={
          committee
            ? "Give every application a thoughtful review. All decisions are simulated."
            : "Get to know the ideas and people shaping our community’s next chapter."
        }
        action={
          committee ? (
            <Badge tone="yellow">
              {candidates.filter((c) => c.status === "Pending").length} pending
              review
            </Badge>
          ) : (
            <ButtonLink href="/student/apply">
              Become a candidate
              <ArrowRight size={16} />
            </ButtonLink>
          )
        }
      />
      <Notice>
        {committee
          ? "All applications and review decisions are fictional and remain in this browser session."
          : "These are fictional profiles. Only approved demo candidates appear in this directory."}
      </Notice>
      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search candidates…"
        />
        <FilterControl
          label="Filter by office"
          value={office}
          onChange={setOffice}
          options={["All offices", ...offices]}
        />
        {committee && (
          <FilterControl
            label="Filter by application status"
            value={status}
            onChange={setStatus}
            options={["All statuses", "Pending", "Approved", "Rejected"]}
          />
        )}
      </div>
      <div className="results-summary">
        <span>
          {visible.length} {visible.length === 1 ? "candidate" : "candidates"}
        </span>
        <span>Fictional demonstration profiles</span>
      </div>
      {visible.length ? (
        <div className="candidate-grid">
          {visible.map((c) => (
            <CandidateCard key={c.id} candidate={c} committee={committee} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setOffice("All offices");
                  setStatus("All statuses");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      )}
    </>
  );
}

export function CandidateProfile({
  id,
  committee = false,
}: {
  id: string;
  committee?: boolean;
}) {
  const demo = useDemo();
  const candidate = demo.candidates.find(
    (c) => c.id === id && (committee || c.status === "Approved"),
  );
  const [decision, setDecision] = useState<"Approved" | "Rejected" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  if (!candidate)
    return (
      <>
        <PageHeader
          title="Profile unavailable"
          description="This fictional candidate may not exist or may still be awaiting approval."
        />
        <Card>
          <EmptyState
            title="Candidate not found"
            description="Return to the directory to explore available demo candidates."
            action={
              <ButtonLink
                href={`/${committee ? "committee" : "student"}/candidates`}
              >
                Back to candidates
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  function review() {
    if (!candidate || !decision) return;
    demo.setCandidates((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: decision,
              reason: decision === "Rejected" ? reason.trim() : undefined,
            }
          : c,
      ),
    );
    demo.log(`Demo application ${decision.toLowerCase()}: ${candidate.name}`);
    setReason("");
  }
  return (
    <>
      <PageHeader
        back={`/${committee ? "committee" : "student"}/candidates`}
        eyebrow={committee ? "APPLICATION REVIEW" : "CANDIDATE PROFILE"}
        title={
          committee
            ? "Review the vision. Know the candidate."
            : "A vision for our community."
        }
        description="Fictional candidate profile · UCSA General Election 2026"
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <Avatar name={candidate.name} photo={candidate.photo} large />
          <Badge>{candidate.status}</Badge>
          <h2>{candidate.name}</h2>
          <span className="profile-office">{candidate.office}</span>
          <div className="profile-facts">
            <span>
              <GraduationCap size={17} />
              UNILAK student · Demo
            </span>
            <span>
              <ShieldCheck size={17} />
              Fictional eligibility record
            </span>
            {committee && (
              <>
                <span>
                  <UserRound size={17} />
                  {candidate.registration}
                </span>
                <span>
                  <Mail size={17} />
                  {candidate.email}
                </span>
              </>
            )}
          </div>
          {committee ? (
            <div className="stack">
              <Button
                disabled={candidate.status === "Approved"}
                onClick={() => setDecision("Approved")}
              >
                <Check size={17} />
                Approve simulation
              </Button>
              <Button
                variant="danger"
                disabled={candidate.status === "Rejected"}
                onClick={() => setDecision("Rejected")}
              >
                Reject with reason
              </Button>
            </div>
          ) : (
            <ButtonLink href="/student/vote">
              Try the ballot demo
              <ArrowRight size={16} />
            </ButtonLink>
          )}
          <p className="muted small">
            Neutral portrait placeholder shown where no demo photo is supplied.
          </p>
        </Card>
        <div className="stack">
          <Card>
            <CardHeading title="About the candidate" />
            <p className="prose">{candidate.bio}</p>
          </Card>
          <Card>
            <CardHeading
              title="Manifesto"
              description="The ideas behind the campaign."
            />
            <p className="prose">{candidate.manifesto}</p>
          </Card>
          <Card>
            <CardHeading title="Key priorities" />
            <div className="priority-list">
              {candidate.priorities.map((p, i) => (
                <div key={p}>
                  <span className="priority-number">0{i + 1}</span>
                  <Target size={20} />
                  <strong>{p}</strong>
                </div>
              ))}
            </div>
          </Card>
          {candidate.reason && (
            <Notice tone="yellow">
              <strong>Review explanation</strong>
              <p>{candidate.reason}</p>
            </Notice>
          )}
        </div>
      </div>
      <ConfirmationDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={`${decision === "Approved" ? "Approve" : "Reject"} this demo application?`}
        description="This changes fictional application status for this session only."
        danger={decision === "Rejected"}
        disabled={decision === "Rejected" && reason.trim().length < 10}
        onConfirm={review}
        label={
          decision === "Approved" ? "Approve simulation" : "Reject simulation"
        }
      >
        {decision === "Rejected" && (
          <label className="field">
            Reason for rejection
            <textarea
              aria-label="Reason for rejection"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              placeholder="Explain the decision in at least 10 characters."
              rows={4}
            />
            <span className="muted small">
              The student will see this explanation in the demo status view.
            </span>
          </label>
        )}
      </ConfirmationDialog>
    </>
  );
}
