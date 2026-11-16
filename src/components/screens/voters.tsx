"use client";

import { useState } from "react";
import { Check, Eye, ShieldCheck, Users } from "lucide-react";
import { useDemo } from "../demo-provider";
import {
  Avatar,
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
  Stat,
} from "../ui";
import { matches } from "@/lib/utils";
import type { Voter } from "@/types";

export function VoterVerification() {
  const demo = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [selected, setSelected] = useState<string | null>(null);
  const [decision, setDecision] = useState<"Verified" | "Ineligible" | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const voter = demo.voters.find((v) => v.id === selected);
  const visible = demo.voters.filter(
    (v) =>
      matches(query, v.name, v.registration, v.email) &&
      (filter === "All statuses" || v.status === filter),
  );
  function update() {
    if (!voter || !decision) return;
    demo.setVoters((prev) =>
      prev.map((v) =>
        v.id === voter.id
          ? {
              ...v,
              status: decision,
              reason: decision === "Ineligible" ? reason.trim() : undefined,
            }
          : v,
      ),
    );
    demo.log(`Demo voter ${decision.toLowerCase()}: ${voter.name}`);
    setReason("");
  }
  const rows = (v: Voter) => (
    <>
      <div className="voter-identity">
        <Avatar name={v.name} />
        <span>
          <strong>{v.name}</strong>
          <small className="muted">{v.email}</small>
        </span>
      </div>
      <span className="registration">{v.registration}</span>
      <span>{v.faculty}</span>
      <Badge>{v.status}</Badge>
      <Button variant="ghost" onClick={() => setSelected(v.id)}>
        <Eye size={16} />
        Review<span className="sr-only"> {v.name}</span>
      </Button>
    </>
  );
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / ELIGIBILITY"
        title="Every student deserves a fair review."
        description="Explore verification decisions using a fictional student register."
      />
      <div className="stats-grid three">
        <Stat
          label="Registered students"
          value={demo.voters.length}
          detail="Fictional records only"
          icon={<Users size={20} />}
        />
        <Stat
          label="Verified"
          value={demo.voters.filter((v) => v.status === "Verified").length}
          detail="Demo eligibility confirmed"
          icon={<ShieldCheck size={20} />}
          tone="green"
        />
        <Stat
          label="Pending review"
          value={demo.voters.filter((v) => v.status === "Pending").length}
          detail="Awaiting a simulated decision"
          icon={<Check size={20} />}
          tone="yellow"
        />
      </div>
      <Card>
        <div className="toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search name, registration, or email…"
          />
          <FilterControl
            label="Verification status"
            value={filter}
            onChange={setFilter}
            options={["All statuses", "Verified", "Pending", "Ineligible"]}
          />
        </div>
        <div className="results-summary">
          <span>{visible.length} demo students</span>
          <span>Eligibility list · Fictional data</span>
        </div>
        {visible.length ? (
          <div
            className="responsive-table voter-table"
            role="table"
            aria-label="Fictional voter register"
          >
            <div className="table-head" role="row">
              <span role="columnheader">Student</span>
              <span role="columnheader">Registration number</span>
              <span role="columnheader">Faculty</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Action</span>
            </div>
            {visible.map((v) => (
              <div className="table-row" role="row" key={v.id}>
                {/* Each cell remains available in the mobile card layout. */}
                {Array.from([rows(v).props.children])
                  .flat()
                  .map((cell, i) => (
                    <div
                      role="cell"
                      key={i}
                      data-label={
                        [
                          "Student",
                          "Registration",
                          "Faculty",
                          "Status",
                          "Action",
                        ][i]
                      }
                    >
                      {cell}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </Card>
      <Notice>
        Demo verification does not authenticate identity or establish
        eligibility. Real enrollment checks and committee authorization belong
        in Phase 2.
      </Notice>
      <Modal
        open={!!voter && !decision}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Review demo student"
        description="A fictional eligibility record for interface testing."
      >
        {voter && (
          <div className="stack">
            <div className="person-row">
              <Avatar name={voter.name} />
              <strong>{voter.name}</strong>
              <Badge>{voter.status}</Badge>
            </div>
            <dl className="details-list">
              <div>
                <dt>Registration</dt>
                <dd>{voter.registration}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{voter.email}</dd>
              </div>
              <div>
                <dt>Faculty</dt>
                <dd>{voter.faculty}</dd>
              </div>
              <div>
                <dt>Year of study</dt>
                <dd>Year {voter.year}</dd>
              </div>
            </dl>
            {voter.reason && <Notice tone="yellow">{voter.reason}</Notice>}
            <div className="dialog-actions">
              <Button
                variant="danger"
                disabled={voter.status === "Ineligible"}
                onClick={() => setDecision("Ineligible")}
              >
                Mark ineligible
              </Button>
              <Button
                disabled={voter.status === "Verified"}
                onClick={() => setDecision("Verified")}
              >
                Verify demo student
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title={
          decision === "Verified"
            ? "Verify this demo student?"
            : "Mark this demo student ineligible?"
        }
        description="Only this fictional browser-session record will change."
        label={
          decision === "Verified"
            ? "Confirm demo verification"
            : "Confirm demo rejection"
        }
        danger={decision === "Ineligible"}
        disabled={decision === "Ineligible" && reason.trim().length < 10}
        onConfirm={update}
      >
        {decision === "Ineligible" && (
          <label className="field">
            Decision explanation
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <span className="muted small">
              At least 10 characters. Record a clear, fair explanation.
            </span>
          </label>
        )}
      </ConfirmationDialog>
    </>
  );
}
