"use client";
import { useState, type ChangeEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Modal,
  Notice,
  PageHeader,
} from "@/components/ui";
import {
  previewRoster,
  downloadCsv,
  ROSTER_FILE_BYTES,
  type PreviewRow,
  type RosterEntry,
} from "@/lib/roster-import";
import { AdminTable, Pagination, adminPost } from "./admin-table";

export type RosterListRow = RosterEntry & { id: string; imported_at: string };
type Expectation = {
  email: string;
  status: "approved" | "withdrawn";
  fullName: string;
  academicProgram: string;
} | null;
export function RosterImportManager({
  initial,
  initialTotal,
}: {
  initial: RosterListRow[];
  initialTotal: number;
}) {
  const [records, setRecords] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [expected, setExpected] = useState<Record<string, Expectation>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const changes = preview.filter(
    (row) => !row.errors.length && row.action !== "unchanged",
  );
  async function load(next = 1) {
    const data = await adminPost<{ records: RosterListRow[]; total: number }>(
      "/api/account/roster/list",
      { page: next, search },
    );
    setRecords(data.records);
    setTotal(data.total);
    setPage(next);
  }
  async function inspect(value = text) {
    setBusy(true);
    setError("");
    setMessage("");
    setPreview([]);
    setExpected({});
    try {
      let rows = previewRoster(value);
      if (!rows.some((row) => row.errors.length)) {
        const existing: RosterEntry[] = [];
        for (let start = 0; start < rows.length; start += 250) {
          const result = await adminPost<{ records: RosterEntry[] }>(
            "/api/account/roster/preview",
            {
              records: rows.slice(start, start + 250).map((row) => row.record),
            },
          );
          existing.push(...result.records);
        }
        rows = previewRoster(value, existing);
        const snapshots: Record<string, Expectation> = {};
        for (const row of rows) {
          const current = existing.find(
            (item) =>
              item.registration_number === row.record.registrationNumber,
          );
          snapshots[row.record.registrationNumber] = current
            ? {
                email: current.verified_email,
                status: current.roster_status as "approved" | "withdrawn",
                fullName: current.full_name ?? "",
                academicProgram: current.academic_program ?? "",
              }
            : null;
        }
        setExpected(snapshots);
      }
      setPreview(rows);
      setPreviewPage(1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The file could not be previewed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function file(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setPreview([]);
    setError("");
    setMessage("");
    if (
      !chosen.name.toLowerCase().endsWith(".csv") ||
      chosen.size > ROSTER_FILE_BYTES
    ) {
      setError(
        "Choose a UTF-8 CSV file up to 1 MiB. Export XLSX spreadsheets as CSV first.",
      );
      return;
    }
    try {
      const value = new TextDecoder("utf-8", { fatal: true }).decode(
        await chosen.arrayBuffer(),
      );
      setText(value);
      await inspect(value);
    } catch {
      setError("The file must be valid UTF-8 CSV.");
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    let imported = 0;
    try {
      for (let start = 0; start < changes.length; start += 250) {
        const batch = changes.slice(start, start + 250);
        const result = await adminPost<{ imported: number }>(
          "/api/account/roster/import",
          {
            confirmed: true,
            records: batch.map((row) => ({
              ...row.record,
              expected: expected[row.record.registrationNumber],
            })),
          },
        );
        imported += result.imported;
        setMessage(
          `${imported} records committed. ${changes.length - imported} remain in this file.`,
        );
      }
      setMessage(
        `${imported} roster records imported and audited. No student identity or election eligibility was automatically approved.`,
      );
      setPreview([]);
      setText("");
    } catch (e) {
      setError(
        `${imported} records committed in completed batches. Remaining records were not confirmed as imported. ${e instanceof Error ? e.message : "Import interrupted."} Preview the file again before retrying; unchanged records will be skipped.`,
      );
      setPreview([]);
    } finally {
      setBusy(false);
      setConfirm(false);
      try {
        await load();
      } catch {
        setError((value) => value + " Refresh the page to reload the roster.");
      }
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="RESTRICTED REGISTRY"
        title="Approved student roster"
        description="Import the reviewed institutional roster, inspect changes, then explicitly confirm. Only global committee chairs can access these records."
      />
      <Card>
        <div className="workspace-section-heading">
          <h2>Import roster</h2>
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv("ucsa-roster-template.csv", [
                [
                  "registration_number",
                  "full_name",
                  "email",
                  "academic_program",
                  "status",
                ],
                [
                  "REG-EXAMPLE-001",
                  "Fictional Example — replace before import",
                  "fictional@example.test",
                  "Example program",
                  "approved",
                ],
              ])
            }
          >
            Download CSV template
          </Button>
        </div>
        <p>
          UTF-8 CSV · Up to 5,000 rows / 1 MiB · Required: registration_number,
          email. Optional: full_name, academic_program, status (approved or
          withdrawn).
        </p>
        <label className="field">
          Official roster CSV
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => void file(event)}
          />
        </label>
        <details>
          <summary>Paste CSV instead</summary>
          <label className="field">
            Roster CSV with headers
            <textarea
              rows={6}
              disabled={busy}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPreview([]);
              }}
            />
          </label>
          <Button
            disabled={busy || !text.trim()}
            onClick={() => void inspect()}
          >
            {busy ? "Checking records…" : "Preview roster"}
          </Button>
        </details>
        <Notice>
          Import changes the private matching registry only. Roster corrections
          or withdrawals retain the existing revocation rules. Import does not
          grant identity verification or voting eligibility.
        </Notice>
      </Card>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <div role="status">
          <Notice tone="green">{message}</Notice>
        </div>
      )}
      {busy && (
        <p role="status">
          Validating or processing bounded batches. Please keep this page open.
        </p>
      )}
      {!!preview.length && (
        <section className="stack">
          <div className="workspace-section-heading">
            <h2>Import preview</h2>
            <Badge>{preview.length} rows</Badge>
          </div>
          <p>
            {preview.filter((row) => row.errors.length).length} invalid ·{" "}
            {changes.length} changes ·{" "}
            {preview.filter((row) => row.action === "unchanged").length}{" "}
            unchanged
          </p>
          <AdminTable
            caption="Roster import preview"
            headers={[
              "CSV row",
              "Student / registration",
              "Email",
              "Program",
              "Result",
            ]}
          >
            {preview
              .slice((previewPage - 1) * 25, previewPage * 25)
              .map((row) => (
                <tr key={row.line}>
                  <td>{row.line}</td>
                  <td>
                    <strong>
                      {row.record.fullName || "Name not provided"}
                    </strong>
                    <small>{row.record.registrationNumber}</small>
                  </td>
                  <td>{row.record.email}</td>
                  <td>{row.record.academicProgram || "—"}</td>
                  <td>
                    <Badge
                      tone={
                        row.errors.length
                          ? "red"
                          : row.action === "update"
                            ? "yellow"
                            : "green"
                      }
                    >
                      {row.errors.length ? "Invalid" : row.action}
                    </Badge>
                    {[...row.errors, ...row.warnings].map((note) => (
                      <small key={note}>{note}</small>
                    ))}
                  </td>
                </tr>
              ))}
          </AdminTable>
          <Pagination
            page={previewPage}
            size={25}
            total={preview.length}
            onPage={setPreviewPage}
          />
          <Button
            disabled={
              busy ||
              !changes.length ||
              preview.some((row) => row.errors.length)
            }
            onClick={() => setConfirm(true)}
          >
            Review import of {changes.length} records
          </Button>
        </section>
      )}
      <section className="stack">
        <h2>Current roster</h2>
        <form
          className="admin-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            void load()
              .catch(() => setError("Roster could not be loaded."))
              .finally(() => setBusy(false));
          }}
        >
          <label className="field">
            Find registration number
            <input
              value={search}
              maxLength={40}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Button disabled={busy}>Search roster</Button>
        </form>
        {records.length ? (
          <AdminTable
            caption="Restricted approved roster"
            headers={[
              "Student / registration",
              "University email",
              "Program",
              "Status",
            ]}
          >
            {records.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.full_name || "Name not provided"}</strong>
                  <small>{row.registration_number}</small>
                </td>
                <td>{row.verified_email}</td>
                <td>{row.academic_program || "—"}</td>
                <td>
                  <Badge
                    tone={row.roster_status === "approved" ? "green" : "red"}
                  >
                    {row.roster_status}
                  </Badge>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <div className="empty-state">No roster entries in this view.</div>
        )}
        <Pagination
          page={page}
          size={25}
          total={total}
          busy={busy}
          onPage={(next) => {
            setBusy(true);
            void load(next)
              .catch(() => setError("Roster could not be loaded."))
              .finally(() => setBusy(false));
          }}
        />
      </section>
      <Modal
        open={confirm}
        onOpenChange={(value) => {
          if (!busy) setConfirm(value);
        }}
        title="Confirm official roster import"
        description={`${changes.length} records will be processed in atomic batches of at most 250.`}
      >
        <div className="stack">
          <Notice tone="yellow">
            {changes.filter((row) => row.action === "update").length} existing
            records will change. Corrections may revoke affected identity
            verification and election eligibility. A stale preview is rejected.
            Completed batches remain committed if a later batch fails.
          </Notice>
          <Button disabled={busy} onClick={() => void commit()}>
            {busy
              ? "Importing…"
              : `Confirm import of ${changes.length} records`}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
