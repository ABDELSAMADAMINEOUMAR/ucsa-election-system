"use client";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Modal,
  Notice,
  PageHeader,
} from "@/components/ui";
import {
  AdminTable,
  Pagination,
  adminPost,
  decisionError,
  type DecisionOutcome,
} from "./admin-table";
type Row = {
  id: string;
  full_name: string;
  email: string;
  registration_number: string | null;
  eligibility: { status: string; reason: string | null } | null;
};
export function BulkEligibility({
  elections,
}: {
  elections: { id: string; title: string }[];
}) {
  const [election, setElection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<
    "verified" | "rejected" | "revoked" | null
  >(null);
  const [reason, setReason] = useState("");
  const [results, setResults] = useState<
    (DecisionOutcome & { name: string })[]
  >([]);
  async function load(id = election, next = 1) {
    if (!id) {
      setRows([]);
      setSelected([]);
      setTotal(0);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await adminPost<{ records: Row[]; total: number }>(
        "/api/account/eligibility-queue",
        { electionId: id, page: next, search },
      );
      setRows(data.records);
      setTotal(data.total);
      setPage(next);
      setSelected([]);
    } catch (e) {
      setRows([]);
      setSelected([]);
      setTotal(0);
      setError(
        e instanceof Error ? e.message : "Eligibility could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide() {
    if (!decision || !election) return;
    setBusy(true);
    setError("");
    try {
      const data =
        decision === "revoked"
          ? await (async () => {
              await adminPost("/api/account/election-eligibility", {
                electionId: election,
                userId: selected[0],
                decision,
                reason,
              });
              return {
                results: [
                  { request_id: selected[0], success: true, error_code: null },
                ] as DecisionOutcome[],
              };
            })()
          : await adminPost<{ results: DecisionOutcome[] }>(
              "/api/account/election-eligibility/bulk",
              {
                electionId: election,
                ids: selected,
                decision,
                reason,
                confirmed: true,
              },
            );
      setSelected([]);
      setResults(
        data.results.map((result) => ({
          ...result,
          name:
            rows.find((row) => row.id === result.request_id)?.full_name ||
            "Selected student",
        })),
      );
      setDecision(null);
      setReason("");
      await load(election, page);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Eligibility decisions failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const eligible = rows
    .filter((row) => row.eligibility?.status !== "verified")
    .map((row) => row.id);
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="ELECTION-SCOPED REVIEW"
        title="Election eligibility"
        description="Verified identity is a prerequisite, not permission to vote. Select one election and explicitly review its eligibility decisions."
      />
      <Card>
        <form
          className="admin-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label className="field">
            Election
            <select
              disabled={busy}
              value={election}
              onChange={(event) => {
                const value = event.target.value;
                setElection(value);
                setResults([]);
                void load(value);
              }}
            >
              <option value="">Select an election</option>
              {elections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Search verified student names
            <input
              disabled={busy}
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Button disabled={busy || !election}>Apply filters</Button>
        </form>
      </Card>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!election ? (
        <div className="empty-state">
          Select an election to review permitted verified identities.
        </div>
      ) : (
        <>
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
                onChange={(event) =>
                  setSelected(event.target.checked ? eligible : [])
                }
              />
              Select not-yet-eligible students on this page
            </label>
            <Button
              disabled={
                busy ||
                !selected.length ||
                selected.some((id) => !eligible.includes(id))
              }
              onClick={() => setDecision("verified")}
            >
              Grant selected eligibility
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !selected.length}
              onClick={() => setDecision("rejected")}
            >
              Reject selected
            </Button>
          </div>
          <AdminTable
            caption="Election eligibility review"
            headers={[
              "Select",
              "Verified student",
              "Registration",
              "Election eligibility",
              "Review note",
            ]}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.full_name}`}
                    disabled={busy}
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, row.id]
                          : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <td>
                  <strong>{row.full_name}</strong>
                  <small>{row.email}</small>
                </td>
                <td>{row.registration_number || "Unavailable"}</td>
                <td>
                  <Badge
                    tone={
                      row.eligibility?.status === "verified"
                        ? "green"
                        : "yellow"
                    }
                  >
                    {row.eligibility?.status === "verified"
                      ? "Eligible"
                      : "Not eligible"}
                  </Badge>
                </td>
                <td>
                  {row.eligibility?.reason || "—"}
                  {row.eligibility?.status === "verified" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setSelected([row.id]);
                        setDecision("revoked");
                      }}
                    >
                      Revoke eligibility
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
          {!rows.length && !busy && (
            <div className="empty-state">
              No verified identities match this view.
            </div>
          )}
          <Pagination
            page={page}
            size={25}
            total={total}
            busy={busy}
            onPage={(value) => void load(election, value)}
          />
        </>
      )}
      {!!results.length && (
        <Card>
          <h2>Decision results</h2>
          <p role="status">
            {results.filter((row) => row.success).length} succeeded;{" "}
            {results.filter((row) => !row.success).length} not completed.
          </p>
          <ul>
            {results.map((row) => (
              <li key={row.request_id}>
                {row.name}:{" "}
                {row.success
                  ? "Election decision recorded"
                  : decisionError(row.error_code)}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Modal
        open={decision !== null}
        onOpenChange={(value) => {
          if (!busy && !value) setDecision(null);
        }}
        title="Confirm election eligibility decisions"
        description={`${selected.length} students · ${elections.find((item) => item.id === election)?.title ?? "Selected election"}`}
      >
        <div className="stack">
          <Notice>
            Only this election is affected. Existing identity, election-window
            and committee-scope rules are rechecked per student. No voting
            window is opened.
          </Notice>
          <label className="field">
            {decision !== "verified"
              ? decision === "revoked"
                ? "Reason for revocation (required)"
                : "Reason for rejection (required)"
              : "Decision note (optional)"}
            <textarea
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </label>
          <Button
            disabled={
              busy || (decision !== "verified" && reason.trim().length < 3)
            }
            onClick={() => void decide()}
          >
            {busy ? "Recording…" : `Confirm ${selected.length} decisions`}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
