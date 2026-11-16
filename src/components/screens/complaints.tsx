"use client";

import { useState } from "react";
import { ArrowUpRight, MessageSquareWarning } from "lucide-react";
import { matches, formatDate } from "@/lib/utils";
import { useDemo } from "../demo-provider";
import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  FilterControl,
  Modal,
  Notice,
  PageHeader,
  SearchField,
} from "../ui";

export function ComplaintsScreen() {
  const demo = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [selected, setSelected] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [confirm, setConfirm] = useState(false);
  const complaint = demo.complaints.find((c) => c.id === selected);
  const visible = demo.complaints.filter(
    (c) =>
      matches(query, c.subject, c.id, c.category) &&
      (filter === "All statuses" || c.status === filter),
  );
  function update(status: "Under review" | "Resolved") {
    if (!complaint) return;
    demo.setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaint.id
          ? {
              ...c,
              status,
              resolution: status === "Resolved" ? resolution.trim() : undefined,
            }
          : c,
      ),
    );
    demo.log(`Demo complaint ${complaint.id}: ${status.toLowerCase()}.`);
  }
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / COMMUNITY TRUST"
        title="Listen. Review. Resolve."
        description="A thoughtful process for every concern. All cases shown are fictional."
        action={
          <Badge tone="yellow">
            {demo.complaints.filter((c) => c.status !== "Resolved").length} open
            demo cases
          </Badge>
        }
      />
      <div className="toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search complaint ID, subject, or category…"
        />
        <FilterControl
          label="Complaint status"
          value={filter}
          onChange={setFilter}
          options={["All statuses", "New", "Under review", "Resolved"]}
        />
      </div>
      <div className="stack">
        {visible.length ? (
          visible.map((c) => (
            <Card key={c.id} className="complaint-card">
              <div className="complaint-icon">
                <MessageSquareWarning size={23} />
              </div>
              <div>
                <span className="eyebrow">
                  {c.id} · {c.category}
                </span>
                <h2>{c.subject}</h2>
                <p className="muted">{c.message}</p>
                <span className="muted small">
                  Fictional case · {formatDate(c.date)}
                </span>
              </div>
              <div className="complaint-actions">
                <Badge>{c.status}</Badge>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(c.id);
                    setResolution("");
                  }}
                >
                  View case
                  <ArrowUpRight size={16} />
                  <span className="sr-only"> {c.id}</span>
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <EmptyState
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("All statuses");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        )}
      </div>
      <Notice>
        Case details, review actions, and resolution notes stay in memory. Real
        complaint handling, access restrictions, and audit trails require Phase
        2.
      </Notice>
      <Modal
        open={!!complaint && !confirm}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={complaint?.subject || "Complaint details"}
        description={`${complaint?.id} · Fictional demonstration case`}
      >
        {complaint && (
          <div className="stack">
            <Badge>{complaint.status}</Badge>
            <p className="prose">{complaint.message}</p>
            <dl className="details-list">
              <div>
                <dt>Category</dt>
                <dd>{complaint.category}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatDate(complaint.date)}</dd>
              </div>
            </dl>
            {complaint.resolution && (
              <Notice tone="green">
                <strong>Demo resolution</strong>
                <p>{complaint.resolution}</p>
              </Notice>
            )}
            {complaint.status !== "Resolved" && (
              <>
                <label className="field">
                  Resolution notes
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={4}
                    maxLength={1500}
                    placeholder="Document a clear resolution (at least 10 characters)…"
                  />
                </label>
                <div className="dialog-actions">
                  <Button
                    variant="secondary"
                    disabled={complaint.status === "Under review"}
                    onClick={() => update("Under review")}
                  >
                    Mark under review
                  </Button>
                  <Button
                    disabled={resolution.trim().length < 10}
                    onClick={() => setConfirm(true)}
                  >
                    Resolve demo case
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Resolve this demo complaint?"
        description="Your resolution will be visible in this fictional case for the current session only."
        onConfirm={() => update("Resolved")}
        label="Confirm demo resolution"
      >
        <p className="prose">{resolution}</p>
      </ConfirmationDialog>
    </>
  );
}
