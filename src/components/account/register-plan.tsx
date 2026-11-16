"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Modal, Notice, PageHeader } from "@/components/ui";
import Link from "next/link";
import { adminPost } from "./admin-table";
type Choice = { id: string; title: string; record_count?: number };
export function RegisterPlan({
  elections,
  registers,
}: {
  elections: Choice[];
  registers: Choice[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<{
      electionId: string;
      registerId: string;
      ruleReference: string;
      excluded: string[];
    } | null>(null);
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending({
      electionId: String(data.get("electionId")),
      registerId: String(data.get("registerId")),
      ruleReference: String(data.get("ruleReference")),
      excluded: String(data.get("excluded"))
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    });
  }
  async function commit() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminPost<{ included: number }>(
        "/api/account/register-plan",
        { ...pending, confirmed: true },
      );
      setPending(null);
      setMessage(
        `Election plan approved for ${result.included} registered identities. Account activation is still required; no individual identity-review step is needed.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="ELECTIONS"
        title="Voter eligibility"
        description="Authorize one election's population under an approved UCSA rule. Membership and voting eligibility are separate."
      />
      <Link className="text-link" href="/account/committee/elections">
        Back to Elections
      </Link>
      <Card className="stack">
        <h2>Approve an election register plan</h2>
        <p>
          Every included identity must be in the selected locked register. List
          excluded registration numbers below; unresolved exceptions must stay
          excluded. No eligibility may be added after voting opens.
        </p>
        <form className="stack" onSubmit={review}>
          <label className="field">
            Election
            <select name="electionId" required defaultValue="">
              <option value="" disabled>
                Select election
              </option>
              {elections.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Approved register version
            <select name="registerId" required defaultValue="">
              <option value="" disabled>
                Select locked register
              </option>
              {registers.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.title} · {r.record_count} students
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Approved UCSA rule and exception reference
            <input
              name="ruleReference"
              minLength={5}
              maxLength={500}
              required
            />
          </label>
          <label className="field">
            Excluded registration numbers (one per line)
            <textarea
              name="excluded"
              rows={4}
              placeholder="Only include people permitted by the approved rule."
            />
          </label>
          <Button disabled={busy || !registers.length}>
            Review eligibility plan
          </Button>
        </form>
      </Card>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && (
        <div role="status">
          <Notice>{message}</Notice>
        </div>
      )}
      <Modal
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Confirm election eligibility plan"
        description="This approves a versioned population for this election, not unconditional access for all accounts."
      >
        <div className="stack">
          <p>{elections.find((e) => e.id === pending?.electionId)?.title}</p>
          <p>
            {registers.find((r) => r.id === pending?.registerId)?.title} ·{" "}
            {pending?.excluded.length} exclusions
          </p>
          <p>Rule: {pending?.ruleReference}</p>
          <Button disabled={busy} onClick={() => void commit()}>
            Confirm approved rule and population
          </Button>
        </div>
      </Modal>
    </main>
  );
}
