"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Modal,
  Notice,
  PageHeader,
} from "@/components/ui";
import { AdminTable, Pagination, adminPost } from "./admin-table";
import { roleLabel } from "./workspace-shell";

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) =>
  Array.isArray(value) ? value[0] : value;
export type MemberView = {
  user_id: string;
  role: string;
  election_id: string | null;
  created_at: string;
  profiles: Relation<{ full_name: string; email: string }>;
  elections: Relation<{ title: string }>;
};
export function MemberTable({
  initial,
  elections,
  currentUserId,
}: {
  initial: MemberView[];
  elections: { id: string; title: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lookup, setLookup] = useState("");
  const [accounts, setAccounts] = useState<
    { id: string; full_name: string; email: string }[]
  >([]);
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("verification_officer");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [operation, setOperation] = useState<{
    userId: string;
    role: string;
    electionId: string | null;
    action: "add" | "remove";
    label: string;
  } | null>(null);
  const filtered = initial.filter((item) =>
    `${one(item.profiles)?.full_name} ${one(item.profiles)?.email} ${roleLabel(item.role)} ${one(item.elections)?.title ?? "Global"}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function find() {
    setBusy(true);
    setError("");
    try {
      const data = await adminPost<{ accounts: typeof accounts }>(
        "/api/account/committee-accounts",
        { search: lookup },
      );
      setAccounts(data.accounts);
      setTarget("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account search failed.");
    } finally {
      setBusy(false);
    }
  }
  async function change() {
    if (!operation) return;
    setBusy(true);
    setError("");
    const { label: _label, ...payload } = operation;
    void _label;
    try {
      await adminPost("/api/account/committee-members", payload);
      setMessage("Committee role change recorded in the audit history.");
      setOperation(null);
      setTarget("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role change failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="TRUSTED COMMITTEE REGISTRY"
        title="Committee members"
        description="Assign the minimum authorized role to an existing account. Global chair provisioning remains a separate trusted operation."
      />
      <Card>
        <h2>Assign an authorized role</h2>
        <div className="admin-toolbar">
          <label className="field">
            Find account by email
            <input
              value={lookup}
              minLength={3}
              maxLength={120}
              onChange={(e) => setLookup(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || lookup.trim().length < 3}
            onClick={() => void find()}
          >
            Find accounts
          </Button>
        </div>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const account = accounts.find((item) => item.id === target);
            if (account)
              setOperation({
                userId: target,
                role,
                electionId: scope || null,
                action: "add",
                label: `${account.full_name || "Account"} · ${account.email}`,
              });
          }}
        >
          <div className="form-grid">
            <label className="field">
              Target account (verify identity before assignment)
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Select an account from the search</option>
                {accounts
                  .filter((account) => account.id !== currentUserId)
                  .map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.full_name || "Account"} · {account.email}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Least privilege role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {[
                  "verification_officer",
                  "candidate_review_officer",
                  "election_administrator",
                  "certifying_officer",
                ].map((value) => (
                  <option value={value} key={value}>
                    {roleLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Election scope
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">Global committee scope</option>
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button disabled={busy || !target}>Review role assignment</Button>
        </form>
        <Notice>
          Verify the target identity and leadership approval before assigning
          access. You cannot change your own privileges or grant the chair role
          here. Account email confirmation and suspension are enforced at
          session authorization.
        </Notice>
      </Card>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && (
        <div role="status">
          <Notice tone="green">{message}</Notice>
        </div>
      )}
      <label className="field">
        Search members
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Name, email, role or election"
        />
      </label>
      <AdminTable
        caption="Committee role assignments"
        headers={["Member", "Role", "Election scope", "Status", "Actions"]}
      >
        {filtered.slice((page - 1) * 25, page * 25).map((item) => (
          <tr key={`${item.user_id}-${item.role}-${item.election_id}`}>
            <td>
              <strong>
                {one(item.profiles)?.full_name || "Committee account"}
              </strong>
              <small>
                {one(item.profiles)?.email || "Account details unavailable"}
              </small>
              <details className="member-details">
                <summary>Account reference</summary>
                <code>{item.user_id}</code>
              </details>
            </td>
            <td>{roleLabel(item.role)}</td>
            <td>
              {item.election_id
                ? one(item.elections)?.title || "Assigned election"
                : "Global"}
            </td>
            <td>
              <Badge>Assigned</Badge>
            </td>
            <td>
              {item.role === "committee_chair" ? (
                <span className="muted small">Trusted administration</span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy || item.user_id === currentUserId}
                  onClick={() =>
                    setOperation({
                      userId: item.user_id,
                      role: item.role,
                      electionId: item.election_id,
                      action: "remove",
                      label: one(item.profiles)?.email || "Selected member",
                    })
                  }
                >
                  Remove role
                </Button>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
      {!filtered.length && (
        <div className="empty-state">
          No role assignments match this search.
        </div>
      )}
      <Pagination
        page={page}
        size={25}
        total={filtered.length}
        onPage={setPage}
      />
      <Modal
        open={operation !== null}
        onOpenChange={(value) => {
          if (!busy && !value) setOperation(null);
        }}
        title="Confirm committee access change"
        description="This change is checked by the trusted registry and recorded in the audit history."
      >
        <div className="stack">
          <p>{operation?.label}</p>
          <p>
            {operation?.action === "add" ? "Assign" : "Remove"}{" "}
            <strong>{roleLabel(operation?.role ?? "")}</strong> ·{" "}
            {operation?.electionId
              ? elections.find((item) => item.id === operation.electionId)
                  ?.title || "Selected election"
              : "Global scope"}
          </p>
          <Button disabled={busy} onClick={() => void change()}>
            {busy ? "Recording…" : "Confirm role change"}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
