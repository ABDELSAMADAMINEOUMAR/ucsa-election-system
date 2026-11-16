"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  PencilLine,
  RotateCcw,
  Vote,
} from "lucide-react";
import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  ConfirmationDialog,
  EmptyState,
  Notice,
  PageHeader,
} from "../ui";

export function BallotScreen() {
  const demo = useDemo();
  const router = useRouter();
  const [error, setError] = useState("");
  const available = demo.election.offices.map((office) => ({
    office,
    candidates: demo.candidates.filter(
      (c) => c.office === office && c.status === "Approved",
    ),
  }));
  return (
    <>
      <PageHeader
        eyebrow="STUDENT / VOTING DEMONSTRATION"
        title="Explore the power of your voice."
        description="Practice choosing your representatives, one office at a time."
        back="/student"
        action={<Badge tone="blue">UI simulation only</Badge>}
      />
      <Notice tone="yellow">
        <strong>No real vote is submitted, stored, or counted.</strong>
        <p>
          This ballot is available for practice regardless of the demo election
          status. Choices exist only in memory and disappear on reload.
        </p>
      </Notice>
      <div className="ballot-layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const valid = available.every(({ office, candidates }) =>
              candidates.some((c) => c.id === demo.ballot[office]),
            );
            if (!valid) {
              setError(
                "Choose one approved demo candidate for every office before reviewing.",
              );
              return;
            }
            setError("");
            router.push("/student/vote/review");
          }}
          className="stack"
        >
          {available.map(({ office, candidates }, index) => (
            <Card key={office}>
              <div className="ballot-office-heading">
                <span className="priority-number">0{index + 1}</span>
                <div>
                  <h2>{office}</h2>
                  <p className="muted small">Choose one demo candidate</p>
                </div>
                {demo.ballot[office] && <Badge tone="green">Selected</Badge>}
              </div>
              <fieldset className="ballot-options">
                <legend className="sr-only">
                  Choose a candidate for {office}
                </legend>
                {candidates.length ? (
                  candidates.map((c) => (
                    <label
                      className={`ballot-card ${demo.ballot[office] === c.id ? "selected" : ""}`}
                      key={c.id}
                    >
                      <input
                        type="radio"
                        name={office}
                        value={c.id}
                        checked={demo.ballot[office] === c.id}
                        onChange={() => {
                          demo.setBallot((prev) => ({
                            ...prev,
                            [office]: c.id,
                          }));
                          demo.setBallotComplete(false);
                        }}
                      />
                      <Avatar name={c.name} photo={c.photo} />
                      <span>
                        <strong>{c.name}</strong>
                        <small className="muted">
                          {c.office} · Fictional candidate
                        </small>
                      </span>
                      <span className="selection-indicator">
                        {demo.ballot[office] === c.id && <Check size={16} />}
                      </span>
                    </label>
                  ))
                ) : (
                  <EmptyState
                    title="No approved demo candidates"
                    description="Use committee candidate review to approve an application for this office."
                    action={
                      <ButtonLink secondary href="/committee/candidates">
                        Review candidates
                      </ButtonLink>
                    }
                  />
                )}
              </fieldset>
            </Card>
          ))}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                demo.setBallot({});
                demo.setBallotComplete(false);
              }}
            >
              Clear choices
            </Button>
            <Button type="submit">
              Review my demo ballot
              <ArrowRight size={17} />
            </Button>
          </div>
        </form>
        <aside>
          <Card className="application-guide">
            <span className="icon-box blue">
              <Vote size={25} />
            </span>
            <h2>
              A moment to choose.
              <br />A future to shape.
            </h2>
            <p className="muted">
              Learn how the voting journey will feel. You can review and change
              your choices before completing the simulation.
            </p>
            <ol className="numbered-list">
              <li>Select a candidate for each office</li>
              <li>Review your selections</li>
              <li>Complete the UI simulation</li>
            </ol>
            <Notice>
              Ballot secrecy, eligibility checks, and duplicate-vote prevention
              require Phase 2 implementation and independent review.
            </Notice>
          </Card>
        </aside>
      </div>
    </>
  );
}

export function BallotReview() {
  const demo = useDemo();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const selections = demo.election.offices.map((office) => ({
    office,
    candidate: demo.candidates.find(
      (c) =>
        c.id === demo.ballot[office] &&
        c.office === office &&
        c.status === "Approved",
    ),
  }));
  const valid = selections.length > 0 && selections.every((s) => !!s.candidate);
  return (
    <>
      <PageHeader
        eyebrow="VOTING DEMO / REVIEW"
        title="A moment to review."
        description="Check your fictional choices before completing this UI simulation."
        back="/student/vote"
      />
      <div className="narrow-content">
        <Notice tone="yellow">
          This demonstration has no legal validity. No ballot will be
          transmitted, persisted, or added to result totals.
        </Notice>
        {valid ? (
          <>
            <Card>
              <h2>Your demo selections</h2>
              <div className="review-selections">
                {selections.map(
                  ({ office, candidate }) =>
                    candidate && (
                      <div className="person-row" key={office}>
                        <Avatar name={candidate.name} photo={candidate.photo} />
                        <span>
                          <small className="muted">{office}</small>
                          <strong>{candidate.name}</strong>
                        </span>
                        <Check className="text-green" size={20} />
                      </div>
                    ),
                )}
              </div>
              <Link href="/student/vote" className="text-link">
                <PencilLine size={16} />
                Edit my selections
              </Link>
            </Card>
            <div className="form-actions">
              <ButtonLink secondary href="/student/vote">
                Go back
              </ButtonLink>
              <Button onClick={() => setConfirm(true)}>
                Complete simulation
                <ArrowRight size={17} />
              </Button>
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              title="Your demo ballot is incomplete"
              description="Choose one approved candidate per office. Reloading clears all selections."
              action={
                <ButtonLink href="/student/vote">Return to ballot</ButtonLink>
              }
            />
          </Card>
        )}
      </div>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Complete the ballot simulation?"
        description="No real vote will be submitted, stored, or counted. Your selections will be cleared immediately."
        label="Finish UI simulation"
        onConfirm={() => {
          demo.setBallot({});
          demo.setBallotComplete(true);
          router.push("/student/vote/success");
        }}
      />
    </>
  );
}

export function BallotSuccess() {
  const demo = useDemo();
  return (
    <div className="success-page">
      <div className="success-icon">
        <CheckCheck size={44} />
      </div>
      <p className="eyebrow">VOTING DEMONSTRATION</p>
      <h1>
        {demo.ballotComplete
          ? "You’ve explored the voting journey."
          : "Ready to explore the voting journey?"}
      </h1>
      <p className="muted">
        {demo.ballotComplete
          ? "Thanks for trying the UCSA ballot experience. Your demo selections have been cleared."
          : "Start the ballot demonstration to practice selecting and reviewing candidates."}
      </p>
      <Notice tone="yellow">
        <strong>No real vote was submitted.</strong>
        <p>
          No selection was stored or counted. Fictional result totals remain
          unchanged.
        </p>
      </Notice>
      <div className="hero-actions">
        <ButtonLink href="/student">
          Back to dashboard
          <ArrowRight size={17} />
        </ButtonLink>
        <ButtonLink secondary href="/student/vote">
          <RotateCcw size={16} />
          Try the demo again
        </ButtonLink>
      </div>
    </div>
  );
}
