"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Modal,
  Notice,
  PageHeader,
} from "@/components/ui";
import { downloadCsv } from "@/lib/roster-import";
import {
  AdminTable,
  Pagination,
  adminPost,
  decisionError,
  type DecisionOutcome,
} from "./admin-table";

export type VerificationRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  requested_registration_number: string;
  status: string;
  created_at: string;
  reason: string | null;
  match_status: "matched" | "unmatched" | "duplicate" | "account_unconfirmed";
};
export type VerificationPage = { records: VerificationRow[]; total: number };
const matchLabel = {
  matched: "Exact match",
  unmatched: "No approved match",
  duplicate: "Duplicate request",
  account_unconfirmed: "Account needs review",
};

export function BulkVerificationTable({
  initial,
}: {
  initial: VerificationPage;
}) {
  const [data, setData] = useState(initial);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"verified" | "rejected" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [outcomes, setOutcomes] = useState<
    (DecisionOutcome & { name: string })[]
  >([]);
  const [size, setSize] = useState(25);
  async function load(
    nextPage = page,
    nextStatus = status,
    nextSearch = search,
    nextSize = size,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await adminPost<VerificationPage>(
        "/api/account/verification-queue",
        {
          page: nextPage,
          size: nextSize,
          search: nextSearch,
          status: nextStatus,
        },
      );
      setData(result);
      setPage(nextPage);
      setSize(nextSize);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Queue unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function filter(event: FormEvent) {
    event.preventDefault();
    await load(1);
  }
  const pending = data.records.filter((row) => row.status === "pending");
  const eligible = pending
    .filter((row) => row.match_status === "matched")
    .map((row) => row.id);
  const approveAllowed =
    selected.length > 0 && selected.every((id) => eligible.includes(id));
  async function submit() {
    if (!decision) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminPost<{ results: DecisionOutcome[] }>(
        "/api/account/verification-requests/bulk",
        { ids: selected, decision, reason, confirmed: true },
      );
      setSelected([]);
      setOutcomes(
        result.results.map((row) => ({
          ...row,
          name:
            data.records.find((item) => item.id === row.request_id)
              ?.full_name || "Selected student",
        })),
      );
      setDecision(null);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="IDENTITY ADMINISTRATION"
        title="Student verification"
        description="Review confirmed student identities against the approved roster. Identity verification does not grant election eligibility."
      />
      <div className="workspace-section-heading">
        <span className="muted">{data.total} requests in this view</span>
        <Button
          variant="secondary"
          disabled={busy || !data.records.length}
          onClick={() =>
            downloadCsv("ucsa-verification-page.csv", [
              [
                "Name",
                "Registration",
                "Email",
                "Roster match",
                "Status",
                "Submitted",
              ],
              ...data.records.map((row) => [
                row.full_name,
                row.requested_registration_number,
                row.email,
                matchLabel[row.match_status],
                row.status,
                row.created_at,
              ]),
            ])
          }
        >
          Export current page
        </Button>
      </div>
      <Card>
        <form className="admin-toolbar" onSubmit={filter}>
          <label className="field">
            Search requests
            <input
              value={search}
              maxLength={120}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, registration or email"
            />
          </label>
          <label className="field">
            Verification status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="revoked">Revoked</option>
              <option value="all">All statuses</option>
            </select>
          </label>
          <label className="field">
            Rows per page
            <select
              value={size}
              disabled={busy}
              onChange={(event) =>
                void load(1, status, search, Number(event.target.value))
              }
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <Button disabled={busy}>{busy ? "Loading…" : "Apply filters"}</Button>
        </form>
      </Card>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="bulk-bar">
        <strong>{selected.length} selected</strong>
        <label className="checkbox-line">
          <input
            type="checkbox"
            disabled={busy || !eligible.length}
            checked={
              eligible.length > 0 &&
              eligible.every((id) => selected.includes(id))
            }
            onChange={(e) => setSelected(e.target.checked ? eligible : [])}
          />
          Select all eligible on this page
        </label>
        <Button
          disabled={busy || !approveAllowed}
          onClick={() => setDecision("verified")}
        >
          Approve selected
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !selected.length}
          onClick={() => setDecision("rejected")}
        >
          Reject selected
        </Button>
      </div>
      {data.records.length ? (
        <AdminTable
          caption="Student verification requests"
          headers={[
            "Select",
            "Student",
            "Registration",
            "Roster match",
            "Status",
            "Submitted",
            "Actions",
          ]}
        >
          {data.records.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${row.full_name || row.email}`}
                  disabled={busy || row.status !== "pending"}
                  checked={selected.includes(row.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, row.id]
                        : selected.filter((id) => id !== row.id),
                    )
                  }
                />
              </td>
              <td>
                <strong>{row.full_name || "Student account"}</strong>
                <small>{row.email}</small>
              </td>
              <td>{row.requested_registration_number}</td>
              <td>
                <Badge
                  tone={row.match_status === "matched" ? "green" : "yellow"}
                >
                  {matchLabel[row.match_status]}
                </Badge>
              </td>
              <td>
                <Badge
                  tone={
                    row.status === "verified"
                      ? "green"
                      : row.status === "pending"
                        ? "yellow"
                        : "red"
                  }
                >
                  {row.status}
                </Badge>
                {row.reason && <small>{row.reason}</small>}
              </td>
              <td>{new Date(row.created_at).toLocaleDateString("en-GB")}</td>
              <td>
                {row.status === "pending" ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setSelected([row.id]);
                      setDecision(
                        row.match_status === "matched"
                          ? "verified"
                          : "rejected",
                      );
                    }}
                  >
                    {row.match_status === "matched"
                      ? "Review match"
                      : "Review rejection"}
                  </Button>
                ) : (
                  "Reviewed"
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <div className="empty-state">
          <h2>No requests in this view</h2>
          <p>
            Change the filters or wait for a confirmed student to submit a
            verification request.
          </p>
        </div>
      )}
      <Pagination
        page={page}
        size={size}
        total={data.total}
        busy={busy}
        onPage={(value) => void load(value)}
      />
      {!!outcomes.length && (
        <Card>
          <h2>Decision results</h2>
          <p role="status">
            {outcomes.filter((row) => row.success).length} succeeded;{" "}
            {outcomes.filter((row) => !row.success).length} not completed.
          </p>
          <ul>
            {outcomes.map((row) => (
              <li key={row.request_id}>
                {row.name}:{" "}
                {row.success
                  ? "Decision recorded"
                  : decisionError(row.error_code)}
              </li>
            ))}
          </ul>
          <Notice>
            Unmatched, duplicate or concurrently reviewed requests are not
            approved. Review each unsuccessful result before retrying.
          </Notice>
        </Card>
      )}
      <Modal
        open={decision !== null}
        onOpenChange={(value) => {
          if (!busy && !value) setDecision(null);
        }}
        title={
          decision === "verified"
            ? "Confirm student verification"
            : "Confirm rejection"
        }
        description={`${selected.length} selected request${selected.length === 1 ? "" : "s"} will be processed individually and audited.`}
      >
        <div className="stack">
          <Notice>
            {decision === "verified"
              ? "Only exact approved registration and confirmed-email matches can succeed. No election eligibility will be created."
              : "Every rejection requires a reason. Existing verified eligibility is handled by the current database rules."}
          </Notice>
          <label className="field">
            {decision === "rejected"
              ? "Reason for rejection (required)"
              : "Decision note (optional)"}
            <textarea
              value={reason}
              maxLength={1000}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            disabled={
              busy || (decision === "rejected" && reason.trim().length < 3)
            }
            onClick={() => void submit()}
          >
            {busy
              ? "Recording decisions…"
              : `Confirm ${decision === "verified" ? "approval" : "rejection"} of ${selected.length}`}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
