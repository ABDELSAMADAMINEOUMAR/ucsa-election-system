"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Notice } from "@/components/ui";
export function ActivationForm({ initial = "" }: { initial?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: new FormData(event.currentTarget).get(
            "registrationNumber",
          ),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.replace("/account/student");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Activation is unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Activate student access</h2>
      <p>
        Use your official UNILAK registration number. Your confirmed account
        email must match the approved register.
      </p>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          UNILAK registration number
          <input
            name="registrationNumber"
            defaultValue={initial}
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9/-]+"
            autoComplete="off"
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button disabled={busy}>
          {busy ? "Checking…" : "Activate my account"}
        </Button>
      </form>
      <Notice>
        Account activation does not grant a vote in every election. The
        committee authorizes each election separately.
      </Notice>
      <Link className="text-link" href="/help">
        Contact the committee / Request a correction
      </Link>
      <Link className="text-link" href="/account/reset-password">
        Recover your account
      </Link>
    </Card>
  );
}
