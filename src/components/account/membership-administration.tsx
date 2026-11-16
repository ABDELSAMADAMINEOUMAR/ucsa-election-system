"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { adminPost } from "./admin-table";
export function MembershipAdministration() {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      !window.confirm(
        "Suspend or revoke this membership? Further student access will stop. Accepted ballots and audit history remain.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/account/register-corrections", {
        action: "suspend",
        registrationNumber: String(
          form.get("registrationNumber"),
        ).toUpperCase(),
        status: form.get("status"),
        reason: form.get("reason"),
      });
      setMessage(
        "Membership access stopped and decision audited. Existing ballots remain unchanged.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Membership security</h2>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Official registration number
          <input name="registrationNumber" required maxLength={40} />
        </label>
        <label className="field">
          Action
          <select name="status">
            <option value="suspended">Suspend access</option>
            <option value="revoked">Revoke access</option>
          </select>
        </label>
        <label className="field">
          Documented reason
          <textarea name="reason" minLength={10} maxLength={1000} required />
        </label>
        <Button disabled={busy}>Review membership restriction</Button>
      </form>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <Notice>{message}</Notice>}
    </Card>
  );
}
