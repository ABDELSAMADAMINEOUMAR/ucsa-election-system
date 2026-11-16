"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Modal, Notice } from "@/components/ui";
import { adminPost } from "./admin-table";
export function SlateForm({
  elections,
}: {
  elections: { id: string; title: string }[];
}) {
  const [id, setId] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  function review(event: FormEvent) {
    event.preventDefault();
    setConfirm(true);
  }
  async function finalize() {
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/account/candidate-slate", {
        electionId: id,
        confirmed: true,
      });
      setConfirm(false);
      setMessage(
        "Approved candidate slate finalized. Candidate changes are now frozen.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalization failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Finalize approved candidates</h2>
      <p>
        After nominations close and independent decisions finish, freeze the
        approved slate before opening voting. An applicant cannot finalize their
        own election?s slate.
      </p>
      <form className="stack" onSubmit={review}>
        <label className="field">
          Election
          <select value={id} onChange={(e) => setId(e.target.value)} required>
            <option value="">Select election</option>
            {elections.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy}>Review slate finalization</Button>
      </form>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <Notice>{message}</Notice>}
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Finalize candidate slate"
        description="Only approved candidates in this finalized slate can be accepted on ballots."
      >
        <div className="stack">
          <p>{elections.find((e) => e.id === id)?.title}</p>
          <Button disabled={busy} onClick={() => void finalize()}>
            Confirm finalized candidates
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
