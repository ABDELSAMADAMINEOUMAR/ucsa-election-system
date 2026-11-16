"use client";
import { useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Modal, Notice, PageHeader } from "@/components/ui";
import { AdminTable, Pagination, adminPost } from "./admin-table";
type Register = {
  id: string;
  title: string;
  status: string;
  file_name: string;
  created_at: string;
};
type Preview = {
  id: string;
  title: string;
  status: string;
  fileName: string;
  snapshot: string;
  sourceSha256: string;
  reason: string;
  total: number;
  invalid: number;
  conflicts: number;
  rows: {
    line: number;
    record: { fullName: string; registrationNumber: string; email: string };
    errors: string[];
  }[];
};
export function OfficialRegister({
  registers,
  hasApproved = false,
  chair = true,
}: {
  registers: Register[];
  hasApproved?: boolean;
  chair?: boolean;
}) {
  const router = useRouter();
  const uploadKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false);
  async function load(id: string, pageNumber = 1) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/account/official-register?id=${id}&page=${pageNumber}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
      setPage(pageNumber);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Preview unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const fingerprint =
        Array.from(new Uint8Array(digest))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("") +
        JSON.stringify(
          Array.from(form.entries()).filter(
            ([, value]) => typeof value === "string",
          ),
        );
      if (uploadKey.current?.fingerprint !== fingerprint)
        uploadKey.current = { fingerprint, key: crypto.randomUUID() };
      const headers: Record<string, string> = {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
        "x-requestKey": uploadKey.current.key,
      };
      for (const key of [
        "title",
        "membershipOpens",
        "membershipCloses",
        "activationOpens",
        "activationCloses",
      ])
        headers[`x-${key}`] =
          key === "title"
            ? encodeURIComponent(String(form.get(key)))
            : `${form.get(key)}+02:00`;
      headers["x-reason"] = encodeURIComponent(
        String(form.get("reason") ?? ""),
      );
      const response = await fetch("/api/account/official-register", {
        method: "POST",
        headers,
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load(result.id);
      setMessage("File staged for review. No voter access has been granted.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/account/official-register", {
        id: preview.id,
        snapshot: preview.snapshot,
        confirmed: true,
      });
      setConfirm(false);
      await load(preview.id);
      setMessage(
        "Register approved and locked. Election eligibility still requires its own authorized rule decision.",
      );
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }
  async function correction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const result = await adminPost<{ proposalId?: string }>(
        "/api/account/register-corrections",
        { ...data, action: "correct", registerId: preview?.id },
      );
      setMessage(
        "Correction proposed. A different authorized chair must review and approve the new version.",
      );
      if (result.proposalId) await load(result.proposalId);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Correction unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="COMMITTEE"
        title="Voter Register"
        description="Upload → Validate → Review → Approve and lock. An uploaded file is never authority by itself."
      />
      <Notice tone="yellow">
        Local rehearsal only. Use fictional records. Real student activation and
        elections remain disabled.
      </Notice>
      <Card className="stack">
        <div className="heading-row">
          <h2>Upload official list</h2>
          <div className="account-actions">
            <a
              className="text-link"
              href="/api/account/register-template?format=xlsx"
            >
              Excel template
            </a>
            <a
              className="text-link"
              href="/api/account/register-template?format=csv"
            >
              CSV template
            </a>
          </div>
        </div>
        <p>
          Required: full name, UNILAK registration number and email. Up to 5,000
          rows; XLSX up to 5 MiB, CSV up to 1 MiB. Use one worksheet and text
          identity cells.
        </p>
        <form className="stack" onSubmit={upload}>
          <label className="field">
            Register title
            <input name="title" minLength={5} maxLength={120} required />
          </label>
          <div className="form-grid">
            {[
              ["membershipOpens", "Membership registration opens"],
              ["membershipCloses", "Membership registration closes"],
              ["activationOpens", "Account activation opens"],
              ["activationCloses", "Account activation closes"],
            ].map(([name, label]) => (
              <label className="field" key={name}>
                {label} (Kigali)
                <input type="datetime-local" name={name} required />
              </label>
            ))}
          </div>
          <label className="field">
            Source approval / change reason
            <textarea
              name="reason"
              minLength={10}
              maxLength={1000}
              required={hasApproved}
            />
          </label>
          <label className="field">
            Official voter file
            <input type="file" name="file" accept=".csv,.xlsx" required />
          </label>
          <Button disabled={busy}>
            {busy ? "Validating…" : "Upload and preview"}
          </Button>
        </form>
        <p className="muted small">
          Membership dates describe the association&apos;s external
          registration. Account activation dates are separate. A normalized,
          hashed source snapshot is retained privately; no automatic deletion is
          performed.
        </p>
      </Card>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <div role="status">
          <Notice>{message}</Notice>
        </div>
      )}
      {preview && (
        <Card className="stack">
          <h2>Review {preview.title}</h2>
          <p>
            {preview.fileName} ·{" "}
            <strong>
              {preview.status === "locked"
                ? "Approved and locked"
                : "Awaiting review"}
            </strong>
          </p>
          <div className="workflow-check">
            <span>{preview.total} records</span>
            <span>
              {preview.total - preview.invalid} valid · {preview.invalid}{" "}
              invalid · {preview.conflicts} identity conflicts
            </span>
          </div>
          {preview.reason && (
            <Notice>Correction reason: {preview.reason}</Notice>
          )}
          <div className="official-register-preview">
            <AdminTable
              caption="Official register preview"
              headers={[
                "Row",
                "Student",
                "Registration number",
                "Email",
                "Validation",
              ]}
            >
              {preview.rows.map((row) => (
                <tr key={row.line}>
                  <td data-label="Row">{row.line}</td>
                  <td data-label="Student">
                    {row.record.fullName || "Missing name"}
                  </td>
                  <td data-label="Registration">
                    {row.record.registrationNumber}
                  </td>
                  <td data-label="Email">{row.record.email}</td>
                  <td data-label="Validation">
                    {row.errors.length ? row.errors.join(" ") : "Valid"}
                  </td>
                </tr>
              ))}
            </AdminTable>
          </div>
          <Pagination
            page={page}
            size={25}
            total={preview.total}
            busy={busy}
            onPage={(number) => void load(preview.id, number)}
          />
          {preview.status !== "locked" && chair && (
            <Button
              disabled={busy || preview.invalid > 0 || preview.conflicts > 0}
              onClick={() => setConfirm(true)}
            >
              Review approval and lock
            </Button>
          )}
          <details>
            <summary>Integrity and retained source</summary>
            {chair && (
              <a
                className="text-link"
                href={`/api/account/official-register?id=${preview.id}&source=1`}
              >
                Download retained normalized source (private JSON)
              </a>
            )}
            <p className="small">
              Source SHA-256: <code>{preview.sourceSha256}</code>
            </p>
            <p className="small">
              Normalized snapshot: <code>{preview.snapshot}</code>
            </p>
            <p>
              These hashes detect differences; they do not protect against a
              privileged database operator.
            </p>
          </details>
          {preview.status === "locked" && (
            <details>
              <summary>Propose a correction</summary>
              <form className="stack" onSubmit={correction}>
                <label className="field">
                  Current registration number
                  <input name="registrationNumber" required maxLength={40} />
                </label>
                <label className="field">
                  Correct registration number
                  <input name="newRegistration" required maxLength={40} />
                </label>
                <label className="field">
                  Official full name
                  <input
                    name="fullName"
                    required
                    minLength={3}
                    maxLength={120}
                  />
                </label>
                <label className="field">
                  Correct email
                  <input name="email" type="email" required />
                </label>
                <label className="field">
                  Reason
                  <textarea
                    name="reason"
                    minLength={10}
                    maxLength={1000}
                    required
                  />
                </label>
                <Button disabled={busy}>
                  Submit correction for independent approval
                </Button>
              </form>
            </details>
          )}
        </Card>
      )}
      <Card className="stack">
        <h2>Register versions</h2>
        {registers.length ? (
          registers.map((register) => (
            <button
              className="secure-list-row"
              key={register.id}
              onClick={() => void load(register.id)}
              disabled={busy}
            >
              <span>
                {register.title}
                <small>{register.file_name}</small>
              </span>
              <strong>
                {register.status === "locked"
                  ? "Approved and locked"
                  : "Awaiting review"}
              </strong>
            </button>
          ))
        ) : (
          <p>No official register has been uploaded.</p>
        )}
        <Link className="text-link" href="/account/committee/administration">
          Corrections, help requests and membership security
        </Link>
      </Card>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Approve and lock official register"
        description={`${preview?.total ?? 0} entries. This decision is audited and cannot be edited in place.`}
      >
        <div className="stack">
          <p>
            Confirm that the source has been authorized, all errors are
            resolved, and the preview is correct. This does not grant
            unconditional election eligibility.
          </p>
          <Button disabled={busy} onClick={() => void approve()}>
            Confirm approval and lock
          </Button>
        </div>
      </Modal>
    </main>
  );
}
