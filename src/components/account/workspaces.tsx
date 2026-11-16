"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ChangeEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FilePlus2,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import Image from "next/image";
import { Badge, Button, Card, Logo, Notice, PageHeader } from "@/components/ui";
import { useHydrated } from "@/lib/use-hydrated";

type Relation<T> = T | T[] | null;
function relationTitle(value: Relation<{ title: string }> | undefined) {
  return Array.isArray(value) ? value[0]?.title : value?.title;
}
type Eligibility = {
  election_id: string;
  status: string;
  reason: string | null;
  elections?: Relation<{ title: string }>;
};
type Election = {
  id: string;
  title: string;
  description?: string;
  status: string;
  nominations_start?: string;
  nominations_end?: string;
  election_offices?: { id: string; title: string }[];
};
type VerificationRequest = {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  requested_registration_number: string;
} | null;
type Application = {
  id: string;
  election_id?: string;
  office_id?: string;
  status: string;
  biography?: string;
  manifesto?: string;
  submitted_at: string | null;
  created_at: string;
  elections?: Relation<{ title: string }>;
  election_offices?: Relation<{ title: string }>;
};

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "The request could not be completed.");
  return data;
}

export function StudentWorkspace({
  name,
  email,
  emailConfirmed,
  verificationStatus,
  request,
  eligibility,
  elections,
  registrationNumber = null,
}: {
  name: string;
  email: string;
  emailConfirmed: boolean;
  verificationStatus: string;
  registrationNumber?: string | null;
  request: VerificationRequest;
  eligibility: Eligibility[];
  elections: Election[];
}) {
  const [registration, setRegistration] = useState(
    request?.requested_registration_number ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postJson("/api/account/verification-requests", {
        registrationNumber: registration,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const currentRequest = done ? "pending" : (request?.status ?? "none");
  return (
    <main className="container stack account-workspace">
      <PageHeader
        eyebrow="REAL STUDENT ACCOUNT"
        title={`Welcome, ${name.split(" ")[0]}.`}
        description={`Signed in as ${email}. Your registration never grants committee or voter privileges by itself.`}
      />
      <div className="metric-grid">
        <div className="metric">
          <span>Account email</span>
          <strong style={{ fontSize: 18 }}>
            {emailConfirmed ? "Email confirmed" : "Confirmation required"}
          </strong>
        </div>
        <div className="metric">
          <span>Registration number</span>
          <strong style={{ fontSize: 18 }}>
            {registrationNumber ||
              request?.requested_registration_number ||
              "Not submitted"}
          </strong>
        </div>
        <div className="metric">
          <span>Eligible elections</span>
          <strong>
            {eligibility.filter((item) => item.status === "verified").length}
          </strong>
        </div>
      </div>
      <div className="account-grid">
        <Card className="secure-record">
          <div className="secure-record-title">
            <GraduationCap />
            <div>
              <h2>Student identity</h2>
              <p>Committee reviewed</p>
            </div>
            <Badge
              tone={
                verificationStatus === "verified"
                  ? "green"
                  : verificationStatus === "rejected" ||
                      verificationStatus === "revoked"
                    ? "red"
                    : "yellow"
              }
            >
              {verificationStatus}
            </Badge>
          </div>
          {verificationStatus === "verified" ? (
            <Notice tone="green">
              <CheckCircle2 /> Your student identity has been reviewed and
              verified.
            </Notice>
          ) : (
            <>
              <p>
                Enter your registration number to request a match against the
                committee approved student roster. The roster is not visible to
                student accounts.
              </p>
              {!emailConfirmed ? (
                <Notice tone="yellow">
                  Confirm your email before requesting student verification.
                </Notice>
              ) : currentRequest === "pending" ? (
                <Notice tone="yellow">
                  <Clock3 /> Verification request pending committee review.
                </Notice>
              ) : (
                <form className="stack" onSubmit={submit}>
                  <label className="field">
                    Student registration number
                    <input
                      required
                      minLength={3}
                      maxLength={40}
                      pattern="[A-Za-z0-9/-]+"
                      value={registration}
                      onChange={(e) => setRegistration(e.target.value)}
                      placeholder="Your official registration number"
                    />
                  </label>
                  <Button type="submit" disabled={busy || !emailConfirmed}>
                    {busy ? (
                      <LoaderCircle className="animate-spin" size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}{" "}
                    {currentRequest === "rejected" ||
                    currentRequest === "revoked"
                      ? "Request a new review"
                      : "Request student verification"}
                  </Button>
                </form>
              )}
              {request?.reason && (
                <p className="muted small">Review note: {request.reason}</p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {done && (
            <Notice tone="green">
              Request received. The committee must review it.
            </Notice>
          )}
        </Card>
        <Card>
          <div className="secure-record-title">
            <UserRoundCheck />
            <div>
              <h2>Election eligibility</h2>
              <p>Each election is reviewed separately</p>
            </div>
          </div>
          {elections.length === 0 ? (
            <p>No election specific eligibility records are available yet.</p>
          ) : eligibility.length ? (
            eligibility.map((item) => (
              <p className="secure-list-row" key={item.election_id}>
                <span>{relationTitle(item.elections) ?? "Election"}</span>
                <Badge tone={item.status === "verified" ? "green" : "yellow"}>
                  {item.status === "verified"
                    ? "Eligible"
                    : item.status === "pending"
                      ? "Pending"
                      : "Not eligible"}
                </Badge>
              </p>
            ))
          ) : (
            <p>
              Your student account has no election specific eligibility yet.
            </p>
          )}
          <p className="muted small">
            Student identity verification does not create eligibility for every
            election.
          </p>
        </Card>
      </div>
      <Card>
        <h2>Election periods</h2>
        {elections.length ? (
          elections.map((election) => (
            <div key={election.id} className="secure-list-row">
              <span>{election.title}</span>
              <Badge>{election.status}</Badge>
            </div>
          ))
        ) : (
          <p>No elections are currently configured. Voting remains disabled.</p>
        )}
      </Card>
      <Link className="text-link" href="/account/student/vote">
        <ShieldCheck size={17} /> Open authenticated voting{" "}
        <ArrowRight size={16} />
      </Link>
      <Link className="text-link" href="/account/student/applications">
        <FilePlus2 size={17} /> View your candidate applications{" "}
        <ArrowRight size={16} />
      </Link>
      <Link className="text-link" href="/account/student/complaints">
        <ShieldCheck size={17} /> Submit or track a private election complaint{" "}
        <ArrowRight size={16} />
      </Link>
    </main>
  );
}

export function CandidateApplicationForm({
  elections,
  applications,
}: {
  elections: Election[];
  applications: Application[];
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const existingDraft = applications.find(
    (item) =>
      item.status === "draft" &&
      elections.some((election) => election.id === item.election_id),
  );
  const [biographyText, setBiographyText] = useState(
    existingDraft?.biography ?? "",
  );
  const [manifestoText, setManifestoText] = useState(
    existingDraft?.manifesto ?? "",
  );
  const [draftId, setDraftId] = useState<string | null>(
    existingDraft?.id ?? null,
  );
  const [selectedElection, setSelectedElection] = useState(
    existingDraft?.election_id ?? "",
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const electionId = String(form.get("electionId"));
    const officeId = String(form.get("officeId"));
    const consent = form.get("consent") === "on";
    let id = draftId;
    function completed() {
      setSuccess(
        "Application submitted for committee review. It is not automatically approved.",
      );
      setPhoto(null);
      setDraftId(null);
      router.refresh();
    }
    try {
      if (!id) {
        const created = await postJson("/api/account/applications", {
          electionId,
          officeId,
          biography: form.get("biography"),
          manifesto: form.get("manifesto"),
          consent,
        });
        id = created.id;
        setDraftId(id);
      }
      const saved = await fetch(`/api/account/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biography: form.get("biography"),
          manifesto: form.get("manifesto"),
          consent,
        }),
      });
      if (!saved.ok)
        throw new Error(
          (await saved.json()).error ?? "Draft changes could not be saved.",
        );
      if (photo) {
        const upload = new FormData();
        upload.set("photo", photo);
        const response = await fetch(`/api/account/applications/${id}/photo`, {
          method: "POST",
          body: upload,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "The photo could not be stored.");
        setPhoto(null);
        const photoInput =
          formElement.querySelector<HTMLInputElement>('input[type="file"]');
        if (photoInput) photoInput.value = "";
      }
      await postJson(`/api/account/applications/${id}/submit`, {});
      completed();
    } catch (e) {
      // A disconnected response may follow a committed submission. Read only
      // this student's status; never create another application blindly.
      let submitted = false;
      if (id) {
        try {
          const status = await fetch(`/api/account/applications/${id}`, {
            cache: "no-store",
          });
          submitted = status.ok && (await status.json()).status === "submitted";
        } catch {
          /* Keep the draft for an explicit retry after reconnection. */
        }
      }
      if (submitted) completed();
      else
        setError(
          e instanceof Error ? e.message : "Application submission failed.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Apply for a position</h2>
      <p>
        Submission requires approved identity, election eligibility, and an
        active nomination period.
      </p>
      {!elections.length ? (
        <Notice>
          No election is currently open for nominations for your verified
          account.
        </Notice>
      ) : (
        <form className="stack" onSubmit={submit}>
          <fieldset
            className="form-fields stack"
            disabled={!hydrated || busy}
            aria-busy={busy}
          >
            <legend className="sr-only">Candidate application details</legend>
            {draftId && (
              <Notice tone="yellow">
                You have an unsubmitted draft. Finish it below before the
                nomination period closes.
              </Notice>
            )}
            <label className="field">
              Election
              <select
                name="electionId"
                required
                value={selectedElection}
                onChange={(event) => setSelectedElection(event.target.value)}
                disabled={!!draftId}
              >
                <option value="">Choose an election</option>
                {elections.map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Position
              <select
                key={selectedElection}
                name="officeId"
                required
                defaultValue={existingDraft?.office_id ?? ""}
                disabled={!!draftId}
              >
                <option value="">Choose an office</option>
                {elections
                  .find((e) => e.id === selectedElection)
                  ?.election_offices?.map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Relevant experience
              <textarea
                name="biography"
                required
                minLength={30}
                maxLength={1000}
                rows={4}
                value={biographyText}
                onChange={(event) => setBiographyText(event.target.value)}
              />
              <span className="muted small">30–1,000 characters</span>
            </label>
            <label className="field">
              Motivation and plans
              <textarea
                name="manifesto"
                required
                minLength={80}
                maxLength={5000}
                rows={7}
                value={manifestoText}
                onChange={(event) => setManifestoText(event.target.value)}
              />
              <span className="muted small">80–5,000 characters</span>
            </label>
            <label className="field">
              Candidate photo (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPhoto(event.target.files?.[0] ?? null)
                }
              />
              <span className="muted small">
                JPEG, PNG or WebP · Maximum 2 MB · Private upload
              </span>
            </label>
            <label className="checkbox-line">
              <input type="checkbox" name="consent" required />
              <span>
                I confirm this information is accurate and understand submission
                is subject to committee review.
              </span>
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <Notice tone="green">
                <CheckCircle2 /> {success}
              </Notice>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Upload size={17} />
              )}{" "}
              {busy ? "Submitting…" : "Submit application for review"}
            </Button>
          </fieldset>
        </form>
      )}
    </Card>
  );
}

export function CommitteeHome({
  roles,
  initialMembers = [],
}: {
  roles: string[];
  initialMembers?: MemberRecord[];
}) {
  return (
    <main className="container stack account-workspace">
      <header className="welcome-header">
        <Logo />
        <Link href="/account" className="text-link">
          <ArrowLeft size={16} /> Account
        </Link>
        <Badge tone="blue">Authorized committee</Badge>
      </header>
      <PageHeader
        eyebrow="SECURE COMMITTEE WORKSPACE"
        title="Committee operations"
        description="Your account can open only tools granted by the trusted committee registry. Each mutation is rechecked by the database."
      />
      <div className="account-grid">
        {roles.includes("verification_officer") ||
        roles.includes("committee_chair") ? (
          <Card>
            <ShieldCheck />
            <h2>Student verification</h2>
            <p>
              Review registration requests and grant election scoped eligibility
              to verified students.
            </p>
            <Link className="text-link" href="/account/committee/verification">
              Open verification queue <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("verification_officer") ||
        roles.includes("committee_chair") ? (
          <Card>
            <UserRoundCheck />
            <h2>Election eligibility</h2>
            <p>Evaluate verified students separately for each election.</p>
            <Link className="text-link" href="/account/committee/eligibility">
              Review eligibility <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("candidate_review_officer") ||
        roles.includes("committee_chair") ? (
          <Card>
            <GraduationCap />
            <h2>Candidate applications</h2>
            <p>Review private submissions and record reasoned decisions.</p>
            <Link className="text-link" href="/account/committee/candidates">
              Open candidate queue <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("committee_chair") ? (
          <Card>
            <UserRoundCheck />
            <h2>Approved roster</h2>
            <p>
              Import or correct a restricted student registration and email
              list.
            </p>
            <Link className="text-link" href="/account/committee/roster">
              Manage approved student roster <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("committee_chair") ||
        roles.includes("election_administrator") ? (
          <Card>
            <Clock3 />
            <h2>Election configuration</h2>
            <p>
              Create draft schedules, prepare elections, and control a local
              demonstration voting window.
            </p>
            <Link className="text-link" href="/account/committee/elections">
              Configure elections <ArrowRight size={16} />
            </Link>
            <Link className="text-link" href="/account/committee/voting">
              Open voting controls <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("certifying_officer") ||
        roles.includes("committee_chair") ? (
          <Card>
            <ShieldCheck />
            <h2>Complaints and certification</h2>
            <p>
              Review private complaints, reconcile closed results, record
              approvals, and publish only certified snapshots.
            </p>
            <Link className="text-link" href="/account/committee/complaints">
              Review complaints <ArrowRight size={16} />
            </Link>
            <Link className="text-link" href="/account/committee/certification">
              Results and certification <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
        {roles.includes("certifying_officer") ||
        roles.includes("committee_chair") ? (
          <Card>
            <ShieldCheck />
            <h2>Closed results review</h2>
            <p>
              View restricted candidate counts only after the scheduled voting
              end. This preview does not certify or publish.
            </p>
            <Link
              className="text-link"
              href="/account/committee/voting/results"
            >
              Open confidential preview <ArrowRight size={16} />
            </Link>
          </Card>
        ) : null}
      </div>
      <Notice tone="yellow">
        Phase 3 adds a local secure voting engine for synthetic testing only. No
        real UCSA election may be opened. Ballot selections remain inaccessible
        to ordinary committee roles; privileged database operators retain
        correlation capabilities.
      </Notice>
      {roles.includes("committee_chair") && (
        <CommitteeMemberManager initial={initialMembers} />
      )}
      {(roles.includes("committee_chair") ||
        roles.includes("election_administrator")) && (
        <Link href="/account/committee/audit" className="text-link">
          View administrative audit history <ArrowRight size={16} />
        </Link>
      )}
    </main>
  );
}

type ElectionRecord = Election & {
  nominations_start: string;
  nominations_end: string;
  voting_start: string;
  voting_end: string;
  election_offices: { id: string; title: string; display_order: number }[];
};
function CertificationPolicyForm({ electionId }: { electionId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await postJson(`/api/account/elections/${electionId}/certification`, {
        action: "configure_policy",
        requiredApprovals: Number(form.get("approvals")),
        policyReference: form.get("policyReference"),
        complaintsRequired: form.get("complaintsRequired") === "on",
        allowReopen: form.get("allowReopen") === "on",
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Configure certification policy</summary>
      <p className="muted">
        Cite the approved UCSA rule. No quorum is assumed by this system.
      </p>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          Required distinct approvals
          <input
            name="approvals"
            type="number"
            min="1"
            max="5"
            defaultValue="1"
            required
          />
        </label>
        <label className="field">
          UCSA policy reference
          <input
            name="policyReference"
            minLength={5}
            maxLength={500}
            required
          />
        </label>
        <label className="check-label">
          <input type="checkbox" name="complaintsRequired" defaultChecked />{" "}
          Require complaint closure
        </label>
        <label className="check-label">
          <input type="checkbox" name="allowReopen" /> Allow chair to reopen a
          case
        </label>
        <Button disabled={busy}>{busy ? "Saving…" : "Save policy"}</Button>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <Notice tone="green">
            Policy saved. Confirm the referenced rule with UCSA before use.
          </Notice>
        )}
      </form>
    </details>
  );
}
export function ElectionAdmin({
  initial,
  listOnly = false,
  chair = false,
  prepareIds = [],
}: {
  initial: ElectionRecord[];
  listOnly?: boolean;
  chair?: boolean;
  prepareIds?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData(formElement);
    const offices = String(form.get("offices"))
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean);
    try {
      await postJson("/api/account/elections", {
        title: form.get("title"),
        description: form.get("description"),
        nominationsStart: form.get("nominationsStart"),
        nominationsEnd: form.get("nominationsEnd"),
        votingStart: form.get("votingStart"),
        votingEnd: form.get("votingEnd"),
        offices,
      });
      setSuccess(
        "Election and offices saved as a draft. No voting has been enabled.",
      );
      formElement.reset();
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Election configuration failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepare(id: string) {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/account/elections/${id}/prepare`, {});
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This election cannot be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container stack account-workspace">
      <Logo />
      <Link href="/account/committee" className="text-link">
        <ArrowLeft size={16} /> Committee workspace
      </Link>
      <PageHeader
        eyebrow="ELECTION ADMINISTRATOR"
        title="Election configuration"
        description="Configure election dates and offices, then prepare a local test election. Authorized administrators control its window in the separate Phase 3 voting workspace."
      />
      {!listOnly && (
        <Card>
          <h2>Configure a draft election</h2>
          <form className="stack" onSubmit={create}>
            <label className="field">
              Election title
              <input name="title" required minLength={5} maxLength={120} />
            </label>
            <label className="field">
              Description
              <textarea name="description" maxLength={1500} rows={3} />
            </label>
            <div className="account-grid">
              <label className="field">
                Nominations open
                <input type="datetime-local" name="nominationsStart" required />
              </label>
              <label className="field">
                Nominations close
                <input type="datetime-local" name="nominationsEnd" required />
              </label>
              <label className="field">
                Voting starts
                <input type="datetime-local" name="votingStart" required />
              </label>
              <label className="field">
                Voting ends
                <input type="datetime-local" name="votingEnd" required />
              </label>
            </div>
            <label className="field">
              Offices (one per line or comma separated)
              <textarea
                name="offices"
                rows={3}
                required
                placeholder={"President\nSecretary General\nTreasurer"}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create draft election"}
            </Button>
          </form>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {success && <Notice tone="green">{success}</Notice>}
        </Card>
      )}
      <section className="stack">
        <h2>Configured elections</h2>
        {initial.map((e) => (
          <Card key={e.id} className="secure-record">
            <div className="secure-record-title">
              <div>
                <h2>{e.title}</h2>
                <p>{e.description}</p>
              </div>
              <Badge>{e.status}</Badge>
            </div>
            <p>
              Nominations:{" "}
              {new Date(e.nominations_start).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}{" "}
              —{" "}
              {new Date(e.nominations_end).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}
            </p>
            <p>
              Voting schedule:{" "}
              {new Date(e.voting_start).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}{" "}
              —{" "}
              {new Date(e.voting_end).toLocaleString("en-RW", {
                timeZone: "Africa/Kigali",
              })}
            </p>
            <p>Offices: {e.election_offices?.map((o) => o.title).join(", ")}</p>
            {e.status === "draft" &&
              (!listOnly || prepareIds.includes(e.id)) && (
                <Button disabled={busy} onClick={() => prepare(e.id)}>
                  {busy ? "Saving…" : "Mark prepared"}
                </Button>
              )}
            {chair && e.status !== "open" && e.status !== "certified" && (
              <CertificationPolicyForm electionId={e.id} />
            )}
          </Card>
        ))}
        {!initial.length && (
          <Card>
            <p>No real elections have been configured.</p>
          </Card>
        )}
      </section>
    </main>
  );
}

export type MemberRecord = {
  user_id: string;
  role: string;
  election_id: string | null;
  created_at: string;
};
export function CommitteeMemberManager({
  initial,
}: {
  initial: MemberRecord[];
}) {
  const [members, setMembers] = useState<MemberRecord[]>(initial);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("verification_officer");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch("/api/account/committee-members", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = await response.json();
    setMembers(data.members ?? []);
  }
  async function change(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await postJson("/api/account/committee-members", {
        userId,
        role,
        electionId: scope || null,
        action: "add",
      });
      setMessage("Committee role assigned and recorded.");
      setUserId("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(member: MemberRecord) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/account/committee-members", {
        userId: member.user_id,
        role: member.role,
        electionId: member.election_id,
        action: "remove",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role removal failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2>Committee member access</h2>
      <p>
        Grant only roles approved by UCSA leadership. The target account must
        already exist. Committee chair privileges require trusted database
        provisioning.
      </p>
      <form onSubmit={change} className="stack">
        <label className="field">
          Account UUID
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            placeholder="Authenticated student account ID"
          />
        </label>
        <label className="field">
          Least privilege role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="verification_officer">Verification officer</option>
            <option value="candidate_review_officer">
              Candidate review officer
            </option>
            <option value="election_administrator">
              Election administrator
            </option>
            <option value="certifying_officer">
              Certifying officer (reserved)
            </option>
          </select>
        </label>
        <label className="field">
          Election scope (optional UUID)
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Leave blank for committee-wide access"
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Saving…" : "Assign committee role"}
        </Button>
      </form>
      {message && <Notice tone="green">{message}</Notice>}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <h3>Active assignments</h3>
      {members.map((m) => (
        <div
          key={`${m.user_id}-${m.role}-${m.election_id}`}
          className="secure-list-row"
        >
          <span>
            {m.user_id}
            <br />
            <span className="muted small">
              {m.role} · {m.election_id ?? "Committee wide"}
            </span>
          </span>
          <Button variant="secondary" disabled={busy} onClick={() => remove(m)}>
            Remove role
          </Button>
        </div>
      ))}
    </Card>
  );
}

export function VerificationQueue({
  initial,
}: {
  initial: {
    id: string;
    user_id: string;
    requested_registration_number: string;
    status: string;
    created_at: string;
    profiles?: {
      full_name: string;
      email: string;
      verification_status: string;
    } | null;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  async function decide(id: string, decision: string) {
    setBusy(id);
    setError("");
    try {
      await postJson(`/api/account/verification-requests/${id}`, {
        decision,
        reason,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="container stack account-workspace">
      <Link href="/account/committee" className="text-link">
        <ArrowLeft size={16} /> Committee workspace
      </Link>
      <PageHeader
        eyebrow="VERIFICATION OFFICER"
        title="Identity review"
        description="Compare each verified email and registration number with the approved roster. Only the roster match can be verified."
      />
      {initial.map((item) => (
        <Card key={item.id} className="secure-record">
          <div className="secure-record-title">
            <ShieldCheck />
            <div>
              <h2>{item.profiles?.full_name || "Student account"}</h2>
              <p>{item.profiles?.email}</p>
            </div>
            <Badge>{item.status}</Badge>
          </div>
          <p>
            Requested registration:{" "}
            <strong>{item.requested_registration_number}</strong>
          </p>
          <p className="muted small">
            Submitted {new Date(item.created_at).toLocaleString()}
          </p>
          {item.status === "pending" ? (
            <>
              <label className="field">
                Decision note (required for rejection)
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                  rows={2}
                />
              </label>
              <div className="account-actions">
                <Button
                  disabled={!!busy}
                  onClick={() => decide(item.id, "verified")}
                >
                  {busy === item.id ? "Saving…" : "Verify from approved roster"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!!busy || reason.trim().length < 3}
                  onClick={() => decide(item.id, "rejected")}
                >
                  Reject with reason
                </Button>
              </div>
            </>
          ) : (
            <p>
              {item.profiles?.verification_status} · {item.status}
            </p>
          )}
        </Card>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!initial.length && (
        <Card>
          <h2>No verification requests</h2>
          <p>
            New requests from email confirmed student accounts will appear here.
          </p>
        </Card>
      )}
    </main>
  );
}

type VerifiedStudent = {
  id: string;
  full_name: string;
  email: string;
  registration_number: string | null;
};
type EligibilityRecord = {
  user_id: string;
  election_id: string;
  status: string;
  reason: string | null;
};
export function ElectionEligibilityReview({
  students,
  elections,
  initial,
}: {
  students: VerifiedStudent[];
  elections: { id: string; title: string }[];
  initial: EligibilityRecord[];
}) {
  const router = useRouter();
  const [electionId, setElectionId] = useState(elections[0]?.id ?? "");
  const [reasonByUser, setReasonByUser] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function decide(
    userId: string,
    decision: "verified" | "rejected" | "revoked",
  ) {
    setBusy(userId);
    setError("");
    setSuccess("");
    try {
      await postJson("/api/account/election-eligibility", {
        userId,
        electionId,
        decision,
        reason: reasonByUser[userId] ?? "",
      });
      setSuccess("Election specific eligibility decision recorded.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eligibility decision failed.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="container stack account-workspace">
      <Link href="/account/committee" className="text-link">
        <ArrowLeft size={16} /> Committee workspace
      </Link>
      <PageHeader
        eyebrow="VERIFICATION OFFICER"
        title="Election specific eligibility"
        description="Global student verification is only a prerequisite. Grant access independently for each election after reviewing that election's criteria."
      />
      {elections.length === 0 ? (
        <Card>
          <h2>No elections configured</h2>
          <p>
            Committee administration must configure an election before
            eligibility is reviewed.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <label className="field">
              Election
              <select
                value={electionId}
                onChange={(event) => setElectionId(event.target.value)}
              >
                {elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.title}
                  </option>
                ))}
              </select>
            </label>
          </Card>
          {students.map((student) => {
            const current = initial.find(
              (record) =>
                record.user_id === student.id &&
                record.election_id === electionId,
            );
            return (
              <Card className="secure-record" key={student.id}>
                <div className="secure-record-title">
                  <UserRoundCheck />
                  <div>
                    <h2>{student.full_name}</h2>
                    <p>
                      {student.registration_number} · {student.email}
                    </p>
                  </div>
                  <Badge
                    tone={
                      current?.status === "verified"
                        ? "green"
                        : current?.status === "rejected" ||
                            current?.status === "revoked"
                          ? "red"
                          : "yellow"
                    }
                  >
                    {current?.status ?? "pending"}
                  </Badge>
                </div>
                {current?.reason && <p>Decision note: {current.reason}</p>}
                {current?.status !== "verified" && (
                  <div className="account-actions">
                    <Button
                      disabled={!!busy || !electionId}
                      onClick={() => decide(student.id, "verified")}
                    >
                      {busy === student.id ? "Saving…" : "Grant eligibility"}
                    </Button>
                    <label className="field">
                      Reason for rejection
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={reasonByUser[student.id] ?? ""}
                        onChange={(event) =>
                          setReasonByUser({
                            ...reasonByUser,
                            [student.id]: event.target.value,
                          })
                        }
                      />
                    </label>
                    <Button
                      variant="secondary"
                      disabled={
                        !!busy ||
                        (reasonByUser[student.id] ?? "").trim().length < 3
                      }
                      onClick={() => decide(student.id, "rejected")}
                    >
                      Reject with reason
                    </Button>
                  </div>
                )}
                {current?.status === "verified" && (
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => decide(student.id, "revoked")}
                  >
                    Revoke eligibility
                  </Button>
                )}
              </Card>
            );
          })}
          {!students.length && (
            <Card>
              <p>
                No globally verified student accounts are available for this
                election yet.
              </p>
            </Card>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {success && <Notice tone="green">{success}</Notice>}
    </main>
  );
}

export function CandidateReviewQueue({
  initial,
}: {
  initial: {
    id: string;
    election_id: string;
    user_id: string;
    full_name: string;
    biography: string;
    manifesto: string;
    status: string;
    submitted_at: string;
    office_title: string;
    election_title: string;
    photoUrl: string | null;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    setError("");
    try {
      await postJson(`/api/account/applications/${id}/decision`, {
        decision,
        reason: reasons[id] ?? "",
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="container stack account-workspace">
      <Link href="/account/committee" className="text-link">
        <ArrowLeft size={16} /> Committee workspace
      </Link>
      <PageHeader
        eyebrow="CANDIDATE REVIEW OFFICER"
        title="Application review"
        description="Each decision is reauthorized and recorded transactionally by the database."
      />
      {initial.map((item) => (
        <Card className="secure-record" key={item.id}>
          {item.photoUrl && (
            <Image
              unoptimized
              width={120}
              height={120}
              className="secure-photo"
              alt={`Private candidate portrait for ${item.full_name}`}
              src={item.photoUrl}
            />
          )}
          <div className="secure-record-title">
            <div>
              <h2>{item.full_name}</h2>
              <p>
                {item.office_title} · {item.election_title}
              </p>
            </div>
            <Badge
              tone={
                item.status === "approved"
                  ? "green"
                  : item.status === "rejected"
                    ? "red"
                    : "yellow"
              }
            >
              {item.status}
            </Badge>
          </div>
          <h3>Biography</h3>
          <p>{item.biography}</p>
          <h3>Manifesto</h3>
          <p className="prose">{item.manifesto}</p>
          <p className="muted small">
            Submitted {new Date(item.submitted_at).toLocaleString()}
          </p>
          {item.status === "submitted" && (
            <>
              <label className="field">
                Reason for rejection
                <textarea
                  value={reasons[item.id] ?? ""}
                  onChange={(e) =>
                    setReasons({ ...reasons, [item.id]: e.target.value })
                  }
                  rows={2}
                  maxLength={1000}
                />
              </label>
              <div className="account-actions">
                <Button
                  disabled={!!busy}
                  onClick={() => decide(item.id, "approved")}
                >
                  {busy === item.id ? "Saving…" : "Approve application"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    !!busy || (reasons[item.id] ?? "").trim().length < 3
                  }
                  onClick={() => decide(item.id, "rejected")}
                >
                  Reject with reason
                </Button>
              </div>
            </>
          )}
        </Card>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {!initial.length && (
        <Card>
          <h2>No applications</h2>
          <p>Submitted applications for assigned elections will appear here.</p>
        </Card>
      )}
    </main>
  );
}

type RosterRecord = {
  id: string;
  registration_number: string;
  verified_email: string;
  roster_status: string;
  imported_at: string;
};
export function RosterManager({ initial }: { initial: RosterRecord[] }) {
  const [records, setRecords] = useState<RosterRecord[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function importRows(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const records = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [registrationNumber, email, status = "approved"] = line
          .split(",")
          .map((part) => part.trim());
        return { registrationNumber, email, status };
      });
    try {
      const data = await postJson("/api/account/roster", { records });
      setMessage(`${data.imported} approved student records saved securely.`);
      setText("");
      const refresh = await fetch("/api/account/roster", { cache: "no-store" });
      if (refresh.ok) {
        const result = await refresh.json();
        setRecords(result.records ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Roster update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container stack account-workspace">
      <Link href="/account/committee" className="text-link">
        <ArrowLeft size={16} /> Committee workspace
      </Link>
      <PageHeader
        eyebrow="COMMITTEE CHAIR"
        title="Approved student roster"
        description="Only the trusted committee chair can import these matching records. Access is not available to students or review officers."
      />
      <Card>
        <h2>Enter or import records</h2>
        <p>
          One entry per line: registration number, confirmed student email,
          status (approved or withdrawn). Use a private channel and a reviewed
          source roster.
        </p>
        <Notice tone="yellow">
          This data contains student identifiers and email addresses. Do not use
          Phase 1 fictional records.
        </Notice>
        <form className="stack" onSubmit={importRows}>
          <label className="field">
            Approved records
            <textarea
              required
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "REG-2026-001, student@unilak.ac.rw, approved\nREG-2026-002, other@unilak.ac.rw, approved"
              }
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving securely…" : "Import approved roster"}
          </Button>
        </form>
        {message && <Notice tone="green">{message}</Notice>}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </Card>
      <section className="stack">
        <h2>Current restricted roster</h2>
        {records.map((record) => (
          <div className="secure-list-row" key={record.id}>
            <span>
              {record.registration_number}
              <br />
              <span className="muted small">{record.verified_email}</span>
            </span>
            <Badge tone={record.roster_status === "approved" ? "green" : "red"}>
              {record.roster_status}
            </Badge>
          </div>
        ))}
        {!records.length && (
          <Card>
            <p>No roster rows are loaded.</p>
          </Card>
        )}
      </section>
    </main>
  );
}
