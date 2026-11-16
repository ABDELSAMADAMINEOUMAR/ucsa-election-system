"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { adminPost } from "./admin-table";
export function CorrectionForm({
  registers,
}: {
  registers: { id: string; title: string }[];
}) {
  const [action, setAction] = useState("correct");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/account/register-corrections", {
        ...data,
        registrationNumber: String(data.registrationNumber).toUpperCase(),
        newRegistration: String(data.newRegistration).toUpperCase(),
        action,
      });
      setMessage(
        "Correction submitted for independent chair approval. The active register is unchanged until approval.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Correction unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Propose a register correction</h2>
      <p>
        Check the official source and support case. A different authorized chair
        must approve the new version; this form grants no access.
      </p>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Correction type
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="correct">Correct official details</option>
            <option value="add">Add an approved missing member</option>
            <option value="withdraw">Withdraw an entry</option>
            <option value="reinstate">Request reinstatement</option>
          </select>
        </label>
        <label className="field">
          Approved register
          <select name="registerId" required defaultValue="">
            <option value="" disabled>
              Select current version
            </option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            Current registration number
            <input name="registrationNumber" maxLength={40} required />
          </label>
          <label className="field">
            Correct registration number
            <input
              name="newRegistration"
              maxLength={40}
              required={action === "correct"}
            />
          </label>
        </div>
        <label className="field">
          Correct official name
          <input
            name="fullName"
            minLength={3}
            maxLength={120}
            required={action === "correct" || action === "add"}
          />
        </label>
        <label className="field">
          Correct email
          <input
            type="email"
            name="email"
            required={action === "correct" || action === "add"}
          />
        </label>
        <label className="field">
          Documented reason and case reference
          <textarea name="reason" minLength={10} maxLength={1000} required />
        </label>
        <Button disabled={busy || !registers.length}>Propose correction</Button>
      </form>
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
    </Card>
  );
}
