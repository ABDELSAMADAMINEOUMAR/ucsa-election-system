"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, Notice, PageHeader } from "@/components/ui";

type Candidate = {
  id: string;
  name: string;
  biography: string;
  manifesto: string;
};
type Office = { id: string; title: string; candidates: Candidate[] };
type Ballot = {
  election: {
    id: string;
    title: string;
    description: string;
    voting_end: string;
  };
  offices: Office[];
};

export function SecureBallot({ electionId }: { electionId: string }) {
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [recorded, setRecorded] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/account/elections/${electionId}/ballot`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "The ballot is unavailable.");
      const officeIds = data.recordedOfficeIds ?? [];
      setError("");
      setBallot(data.ballot);
      setRecorded(officeIds);
      if (
        data.ballot?.offices?.length &&
        data.ballot.offices.every((office: Office) =>
          officeIds.includes(office.id),
        )
      ) {
        setReceipt(true);
        setSelected({});
        setReview(false);
      }
      return officeIds as string[];
    } catch (e) {
      setError(e instanceof Error ? e.message : "The ballot is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [electionId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit() {
    if (!ballot) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/account/elections/${electionId}/ballot`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selections: ballot.offices.map((office) => ({
              officeId: office.id,
              candidateId: selected[office.id],
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Your ballot could not be recorded.");
      // Confirmation is only shown after PostgreSQL commits the atomic transaction.
      setReceipt(true);
      // Drop references after a confirmed commit. This is data minimization,
      // not secure memory erasure or protection against a compromised browser.
      setSelected({});
      setReview(false);
      setLoading(true);
      await load();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Your ballot could not be recorded.";
      setError(message);
      // A lost response may follow a successful commit. Reconcile only the
      // caller's own participation status; never retry choices blindly.
      const officeIds = await load();
      if (
        !ballot.offices.length ||
        !ballot.offices.every((office) => officeIds?.includes(office.id))
      )
        setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container stack account-workspace">
      <Link href="/account/student" className="text-link">
        <ArrowLeft size={16} /> Student workspace
      </Link>
      <PageHeader
        eyebrow="SECURE VOTING · PHASE 3"
        title={receipt ? "Submission recorded" : "Election ballot"}
        description="Choose one candidate for each position, review your choices, and confirm."
      />
      <Notice tone="yellow">
        Ballot choices are hidden from ordinary committee accounts. Database
        operators may still correlate system records; this system does not
        provide cryptographic anonymity. Do not use for a real election until
        independent review.
      </Notice>
      {loading && (
        <Card aria-live="polite">
          <LoaderCircle className="animate-spin" /> Loading eligible ballot…
        </Card>
      )}
      {!loading && error && !ballot && (
        <Card>
          <h2>Ballot unavailable</h2>
          <p role="alert">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </Card>
      )}
      {!loading && ballot && (
        <>
          <Card>
            <div className="secure-record-title">
              <ShieldCheck />
              <div>
                <h2>{ballot.election.title}</h2>
                <p>{ballot.election.description}</p>
              </div>
              <Badge tone="blue">Open</Badge>
            </div>
            <p>
              Voting closes{" "}
              {new Date(ballot.election.voting_end).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}
              . The database clock controls acceptance.
            </p>
          </Card>
          {receipt && (
            <Card>
              <Notice tone="green">
                <CheckCircle2 /> Your submission was accepted by the secure
                voting service. This confirmation contains no candidate choice
                and is not proof of how you voted.
              </Notice>
              <p>Your participation status is available below.</p>
            </Card>
          )}
          {ballot.offices.map((office) => (
            <Card key={office.id} className="stack">
              <div className="secure-record-title">
                <h2>{office.title}</h2>
                {receipt || recorded.includes(office.id) ? (
                  <Badge tone="green">Participation recorded</Badge>
                ) : null}
              </div>
              {receipt || recorded.includes(office.id) ? (
                <Notice tone="green">
                  A ballot has already been recorded for this office. Candidate
                  selections are not shown.
                </Notice>
              ) : review ? (
                <div className="stack">
                  <p>
                    <strong>Selected:</strong>{" "}
                    {
                      office.candidates.find(
                        (item) => item.id === selected[office.id],
                      )?.name
                    }
                  </p>
                  <Button variant="secondary" onClick={() => setReview(false)}>
                    Edit selection
                  </Button>
                </div>
              ) : (
                <fieldset className="stack" disabled={busy}>
                  <legend className="muted">Choose one candidate</legend>
                  {office.candidates.map((candidate) => (
                    <label
                      className="checkbox-line ballot-choice"
                      key={candidate.id}
                    >
                      <input
                        type="radio"
                        name={office.id}
                        value={candidate.id}
                        checked={selected[office.id] === candidate.id}
                        onChange={() =>
                          setSelected({
                            ...selected,
                            [office.id]: candidate.id,
                          })
                        }
                      />
                      <span>
                        <strong>{candidate.name}</strong>
                        <br />
                        <span className="muted">{candidate.biography}</span>
                      </span>
                    </label>
                  ))}
                  {office.candidates.length === 0 && (
                    <p>No approved candidates are available.</p>
                  )}
                </fieldset>
              )}
            </Card>
          ))}
          {!receipt && (
            <Card className="stack">
              <Notice>
                This is a local rehearsal. Real elections are not enabled. Once
                accepted, your selection cannot be changed.
              </Notice>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              {review ? (
                <Button
                  onClick={() => void submit()}
                  disabled={
                    busy ||
                    ballot.offices.some(
                      (office) =>
                        !recorded.includes(office.id) && !selected[office.id],
                    )
                  }
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <ShieldCheck />
                  )}
                  {busy ? "Submitting securely…" : "Confirm and submit ballot"}
                </Button>
              ) : (
                <Button
                  onClick={() => setReview(true)}
                  disabled={
                    ballot.offices.length === 0 ||
                    ballot.offices.some(
                      (office) =>
                        !recorded.includes(office.id) && !selected[office.id],
                    )
                  }
                >
                  Review selections
                </Button>
              )}
            </Card>
          )}
          {receipt && (
            <Link href="/account/student" className="text-link">
              Return to student workspace
            </Link>
          )}
        </>
      )}
    </main>
  );
}
