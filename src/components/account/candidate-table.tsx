"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge, Button, Notice, PageHeader } from "@/components/ui";
import { AdminTable, Pagination, adminPost } from "./admin-table";
export type CandidateRow = {
  id: string;
  full_name: string;
  biography: string;
  manifesto: string;
  status: string;
  submitted_at: string;
  office_title: string;
  election_title: string;
  photoUrl: string | null;
  history?: { decision: string; reason: string; decided_at: string }[];
};
export function CandidateTable({ initial }: { initial: CandidateRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const filtered = initial.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      `${row.full_name} ${row.election_title} ${row.office_title}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await adminPost(`/api/account/applications/${id}/decision`, {
        decision,
        reason: reasons[id] ?? "",
      });
      setMessage(
        "Candidate decision recorded. Identity, election scope, nomination state and independent-review rules were rechecked.",
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The decision could not be completed.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="CANDIDATE ADMINISTRATION"
        title="Candidate applications"
        description="Review private applications for your authorized elections. Decisions retain independent-review requirements and recorded decision history."
      />
      <form
        className="admin-toolbar"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="field">
          Search candidates
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Name, election or office"
          />
        </label>
        <label className="field">
          Application status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="submitted">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </form>
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
      {filtered.length ? (
        <AdminTable
          caption="Candidate applications"
          headers={[
            "Candidate",
            "Election / office",
            "Status",
            "Submitted",
            "Application and decision",
          ]}
        >
          {filtered.slice((page - 1) * 25, page * 25).map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.full_name}</strong>
              </td>
              <td>
                {row.election_title}
                <small>{row.office_title}</small>
              </td>
              <td>
                <Badge
                  tone={
                    row.status === "approved"
                      ? "green"
                      : row.status === "rejected"
                        ? "red"
                        : "yellow"
                  }
                >
                  {row.status}
                </Badge>
              </td>
              <td>{new Date(row.submitted_at).toLocaleDateString("en-GB")}</td>
              <td>
                <details>
                  <summary>View application</summary>
                  <div className="stack">
                    {row.photoUrl && (
                      <Image
                        unoptimized
                        width={120}
                        height={120}
                        className="secure-photo"
                        alt={`Private candidate portrait for ${row.full_name}`}
                        src={row.photoUrl}
                      />
                    )}
                    <h3>Decision history</h3>
                    {row.history?.length ? (
                      <ul>
                        {row.history.map((entry, i) => (
                          <li key={i}>
                            <strong>{entry.decision}</strong> ?{" "}
                            {new Date(entry.decided_at).toLocaleString("en-GB")}
                            <p>
                              {entry.reason || "No decision note recorded."}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No committee decision has been recorded.</p>
                    )}
                    <h3>Biography</h3>
                    <p>{row.biography}</p>
                    <h3>Manifesto</h3>
                    <p className="prose">{row.manifesto}</p>
                    {row.status === "submitted" && (
                      <>
                        <label className="field">
                          Reason for rejection
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={reasons[row.id] ?? ""}
                            onChange={(event) =>
                              setReasons({
                                ...reasons,
                                [row.id]: event.target.value,
                              })
                            }
                          />
                        </label>
                        <div className="account-actions">
                          <Button
                            disabled={!!busy}
                            onClick={() => void decide(row.id, "approved")}
                          >
                            {busy === row.id
                              ? "Saving…"
                              : "Approve application"}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={
                              !!busy ||
                              (reasons[row.id] ?? "").trim().length < 3
                            }
                            onClick={() => void decide(row.id, "rejected")}
                          >
                            Reject with reason
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              </td>
            </tr>
          ))}
        </AdminTable>
      ) : (
        <div className="empty-state">
          <h2>No applications in this view</h2>
          <p>
            Submitted applications for your assigned elections will appear here.
          </p>
        </div>
      )}
      <Pagination
        page={page}
        size={25}
        total={filtered.length}
        onPage={setPage}
      />
    </main>
  );
}
