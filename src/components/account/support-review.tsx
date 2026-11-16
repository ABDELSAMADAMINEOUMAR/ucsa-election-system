"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Notice } from "@/components/ui";
import { adminPost } from "./admin-table";
export function SupportReview({
  items,
}: {
  items: {
    id: string;
    email: string;
    message: string;
    status: string;
    response: string;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function review(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/account/membership-support", {
        id,
        status: data.get("status"),
        response: data.get("response"),
      });
      setMessage(
        "Review recorded. This does not grant access or change the register.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Register exceptions and support</h2>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <Notice>{message}</Notice>}
      {!items.length && <p>No support requests are pending.</p>}
      {items.map((item) => (
        <details key={item.id}>
          <summary>
            {item.email} · {item.status}
          </summary>
          <p>{item.message}</p>
          <form className="stack" onSubmit={(e) => void review(e, item.id)}>
            <label className="field">
              Decision
              <select name="status" defaultValue="reviewed">
                <option value="reviewed">Under review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label className="field">
              Recorded response
              <textarea
                name="response"
                defaultValue={item.response}
                required
                minLength={3}
                maxLength={1000}
              />
            </label>
            <Button disabled={busy}>Record support review</Button>
          </form>
        </details>
      ))}
    </Card>
  );
}
