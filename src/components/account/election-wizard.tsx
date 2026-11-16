"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Notice } from "@/components/ui";
import { adminPost } from "./admin-table";
export function ElectionWizard({
  registers,
  chair,
}: {
  registers: { id: string; title: string; record_count: number }[];
  chair: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [draftId, setDraftId] = useState<string | null>(null);
  const titles = [
    "Election information",
    "Positions",
    "Nomination and voting schedule",
    "Register and election rules",
    "Certification policy",
    "Review and prepare",
  ];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let id = draftId;
    try {
      if (!id) {
        const result = await adminPost<{ id: string }>(
          "/api/account/elections",
          {
            title: form.get("title"),
            description: form.get("description"),
            offices: String(form.get("offices"))
              .split(/[,\n]/)
              .map((x) => x.trim())
              .filter(Boolean),
            nominationsStart: form.get("nominationsStart"),
            nominationsEnd: form.get("nominationsEnd"),
            votingStart: form.get("votingStart"),
            votingEnd: form.get("votingEnd"),
          },
        );
        id = result.id;
        setDraftId(id);
      }
      if (chair) {
        await adminPost("/api/account/register-plan", {
          electionId: id,
          registerId: form.get("registerId"),
          ruleReference: form.get("ruleReference"),
          excluded: String(form.get("excluded"))
            .split(/[\s,]+/)
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean),
          confirmed: true,
        });
        await adminPost(`/api/account/elections/${id}/certification`, {
          action: "configure_policy",
          requiredApprovals: Number(form.get("approvals")),
          policyReference: form.get("policyReference"),
          complaintsRequired: true,
          allowReopen: false,
        });
        await adminPost(`/api/account/elections/${id}/prepare`, {});
        setMessage(
          "Election saved and prepared. Voting stays closed until nominations finish, candidates are finalized, and the authorized voting window opens.",
        );
      } else
        setMessage(
          "Draft saved. An authorized verification officer must approve the register plan and a chair must save certification policy before preparation.",
        );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Election setup could not finish.",
      );
      setMessage(
        id
          ? "Your draft is retained. Fix the missing step and retry; the same draft will be used."
          : "",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="stack">
      <h2>Set up an election</h2>
      <p className="muted">
        Step {step + 1} of {titles.length}: {titles[step]}
      </p>
      <form className="stack" onSubmit={save}>
        <div hidden={step !== 0} className="stack">
          <label className="field">
            Election title
            <input
              name="title"
              minLength={5}
              maxLength={120}
              required
              disabled={!!draftId}
            />
          </label>
          <label className="field">
            Description
            <textarea
              name="description"
              maxLength={1500}
              disabled={!!draftId}
            />
          </label>
          <Notice>
            Local rehearsal only. New elections are explicitly classified as
            synthetic. Real voting remains disabled.
          </Notice>
        </div>
        <div hidden={step !== 1} className="stack">
          <label className="field">
            Positions (one per line)
            <textarea
              name="offices"
              rows={4}
              required
              placeholder="President"
              disabled={!!draftId}
            />
          </label>
        </div>
        <div hidden={step !== 2} className="form-grid">
          {[
            ["nominationsStart", "Nominations open"],
            ["nominationsEnd", "Nominations close"],
            ["votingStart", "Voting starts"],
            ["votingEnd", "Voting ends"],
          ].map(([name, label]) => (
            <label className="field" key={name}>
              {label} (Kigali)
              <input
                type="datetime-local"
                name={name}
                required
                disabled={!!draftId}
              />
            </label>
          ))}
        </div>
        <div hidden={step !== 3} className="stack">
          {chair ? (
            <>
              <label className="field">
                Approved voter register
                <select name="registerId" defaultValue="" required>
                  <option value="" disabled>
                    Select locked register
                  </option>
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} · {r.record_count} students
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Approved election rule reference
                <input
                  name="ruleReference"
                  minLength={5}
                  maxLength={500}
                  required
                />
              </label>
              <label className="field">
                Excluded registration numbers
                <textarea name="excluded" rows={3} />
              </label>
              <p>
                Only identities included under this reviewed rule can become
                eligible. Account activation remains required.
              </p>
            </>
          ) : (
            <Notice>
              A verification officer or chair will complete election-specific
              eligibility after you save the draft.
            </Notice>
          )}
        </div>
        <div hidden={step !== 4} className="stack">
          {chair ? (
            <>
              <label className="field">
                Required distinct approvals
                <input
                  name="approvals"
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={2}
                  required
                />
              </label>
              <label className="field">
                UCSA certification policy reference
                <input
                  name="policyReference"
                  minLength={5}
                  maxLength={500}
                  required
                />
              </label>
              <p>
                All complaints must be resolved before certification. Save
                policy before any reconciliation. This approval count is not
                turnout quorum.
              </p>
            </>
          ) : (
            <Notice>
              Only a chair can establish certification policy. Your draft cannot
              be prepared without it.
            </Notice>
          )}
        </div>
        <div hidden={step !== 5} className="stack">
          <p>
            Review the title, positions, Kigali schedule, approved register and
            rules using Back before confirming. Dates must be strictly ordered:
            nominations open, nominations close, voting start, voting end.
          </p>
          <p>
            Saving records a local test election. It does not authorize a real
            contest or open voting. Eligibility and policy operations are
            checked separately; a failed later step leaves an incomplete draft
            with no voting access.
          </p>
          <Button disabled={busy}>
            {busy
              ? "Saving…"
              : chair
                ? "Confirm setup and prepare"
                : "Save draft for authorized review"}
          </Button>
        </div>
        <div className="account-actions">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          {step < 5 && (
            <Button
              type="button"
              onClick={(event) => {
                const form = event.currentTarget.closest("form");
                const fields = Array.from(
                  form?.querySelectorAll<
                    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                  >("input,textarea,select") ?? [],
                ).filter((field) => !field.closest("[hidden]"));
                if (fields.every((field) => field.reportValidity()))
                  setStep(step + 1);
              }}
            >
              Next
            </Button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && (
        <div role="status">
          <Notice>{message}</Notice>
        </div>
      )}
    </Card>
  );
}
