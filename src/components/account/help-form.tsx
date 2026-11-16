"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Notice } from "@/components/ui";
export function HelpForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          message: form.get("message"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(`${result.message} Reference: ${result.reference}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Message unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Contact the committee</h2>
      <p>
        Ask about a missing or incorrect register entry, account activation, or
        election access. Do not send passwords, confirmation links, passports,
        or ballot choices.
      </p>
      {message ? (
        <div role="status">
          <Notice>{message}</Notice>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            Your email
            <input
              type="email"
              name="email"
              maxLength={254}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            How can we help?
            <textarea
              name="message"
              minLength={10}
              maxLength={2000}
              rows={5}
              required
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
        </form>
      )}
    </Card>
  );
}
