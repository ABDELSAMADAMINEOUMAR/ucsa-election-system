"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Save,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { electionSchema } from "@/lib/schemas";
import { workflow } from "@/lib/utils";
import { offices } from "@/demo/data";
import { useDemo } from "../demo-provider";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  ConfirmationDialog,
  Notice,
  PageHeader,
} from "../ui";

export function ElectionSetup() {
  const demo = useDemo();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof electionSchema>>({
    resolver: zodResolver(electionSchema),
    defaultValues: demo.election,
  });
  const locked = !["Draft", "Prepared"].includes(demo.election.status);
  const error = (name: keyof z.infer<typeof electionSchema>) =>
    errors[name] ? (
      <span className="field-error" id={`${name}-error`} role="alert">
        {errors[name]?.message}
      </span>
    ) : null;
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / ELECTION SETUP"
        title="Set the stage for a fair election."
        description="Define the details, dates, and offices of your local demonstration."
        action={<Badge>{demo.election.status}</Badge>}
      />
      <div className="form-layout">
        <form
          noValidate
          className="stack"
          onSubmit={handleSubmit((data) => {
            demo.setElection((prev) => ({ ...prev, ...data }));
            demo.setBallot({});
            setSaved(true);
            demo.log("Demo election configuration saved.");
          })}
        >
          <Notice>
            Changes affect only this preview and reset on reload. No real
            election record is created.
          </Notice>
          {locked && (
            <Notice tone="yellow">
              Configuration is read-only after the Prepared stage. Reset the
              demo to explore setup again.
            </Notice>
          )}
          <Card>
            <CardHeading
              title="Election information"
              description="Give your community a clear overview."
            />
            <fieldset disabled={locked} className="stack">
              <label className="field">
                Election title
                <input
                  {...register("title")}
                  aria-label="Election title"
                  aria-invalid={!!errors.title}
                  aria-describedby="title-error"
                />
                {error("title")}
              </label>
              <label className="field">
                Election description
                <textarea
                  rows={4}
                  {...register("description")}
                  aria-label="Election description"
                  aria-invalid={!!errors.description}
                  aria-describedby="description-error"
                />
                {error("description")}
              </label>
            </fieldset>
          </Card>
          <Card>
            <CardHeading
              title="Schedule"
              description="All dates and times use Kigali time (CAT, UTC+2)."
            />
            <fieldset disabled={locked} className="form-grid">
              {(
                [
                  {
                    name: "nominationsStart",
                    label: "Nominations open",
                    type: "date",
                  },
                  {
                    name: "nominationsEnd",
                    label: "Nominations close",
                    type: "date",
                  },
                  {
                    name: "votingStart",
                    label: "Voting starts",
                    type: "datetime-local",
                  },
                  {
                    name: "votingEnd",
                    label: "Voting ends",
                    type: "datetime-local",
                  },
                ] as const
              ).map((field) => (
                <label className="field" key={field.name}>
                  {field.label}
                  <input
                    type={field.type}
                    {...register(field.name)}
                    aria-label={field.label}
                    aria-invalid={!!errors[field.name]}
                    aria-describedby={`${field.name}-error`}
                  />
                  {error(field.name)}
                </label>
              ))}
            </fieldset>
          </Card>
          <Card>
            <CardHeading
              title="Leadership offices"
              description="Select the offices included in this demo election."
            />
            <fieldset disabled={locked} className="stack">
              <legend className="sr-only">Election offices</legend>
              {offices.map((office) => (
                <label key={office} className="checkbox-label office-checkbox">
                  <input
                    type="checkbox"
                    value={office}
                    {...register("offices")}
                  />
                  <span>{office}</span>
                </label>
              ))}
              {error("offices")}
            </fieldset>
          </Card>
          {saved && !isDirty && (
            <Notice tone="green">Demo configuration saved in memory.</Notice>
          )}
          <div className="form-actions">
            <ButtonLink secondary href="/committee/controls">
              Election controls
              <ArrowRight size={17} />
            </ButtonLink>
            <Button type="submit" disabled={locked}>
              <Save size={17} />
              Save demo configuration
            </Button>
          </div>
        </form>
        <aside className="stack">
          <Card className="application-guide">
            <span className="icon-box blue">
              <CalendarDays size={24} />
            </span>
            <h2>Clarity builds confidence.</h2>
            <p className="muted">
              A thoughtful schedule gives candidates time to prepare and
              students time to make informed choices.
            </p>
            <ul className="check-list">
              <li>
                <Check size={17} />
                Nominations before voting
              </li>
              <li>
                <Check size={17} />A clear start and end time
              </li>
              <li>
                <Check size={17} />
                At least one leadership office
              </li>
            </ul>
          </Card>
          <Notice>
            In Phase 2, server-side permissions and a locked, audited
            configuration will protect real election setup.
          </Notice>
        </aside>
      </div>
    </>
  );
}

export function ElectionControls() {
  const demo = useDemo();
  const [confirm, setConfirm] = useState(false);
  const stage = workflow.indexOf(demo.election.status);
  const next = workflow[stage + 1];
  const approved = demo.election.offices.every((office) =>
    demo.candidates.some((c) => c.office === office && c.status === "Approved"),
  );
  const verified = demo.voters.some((v) => v.status === "Verified");
  const validConfig = electionSchema.safeParse(demo.election).success;
  const ready = approved && verified && validConfig;
  const canAdvance = !!next && next !== "Certified" && (stage > 1 || ready);
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE / WORKFLOW"
        title="Every stage, a considered step."
        description="Preview the election lifecycle. These controls cannot operate a real election."
        action={<Badge>{demo.election.status}</Badge>}
      />
      <Notice tone="yellow">
        <strong>Local workflow demonstration.</strong> Advancing a stage changes
        only in-memory UI state. It does not open real voting, record ballots,
        or publish real results.
      </Notice>
      <Card>
        <CardHeading
          title="Election lifecycle"
          description={demo.election.title}
        />
        <ol className="workflow">
          {workflow.map((status, i) => (
            <li
              key={status}
              className={i === stage ? "current" : i < stage ? "complete" : ""}
            >
              <span>{i < stage ? <Check size={18} /> : i + 1}</span>
              <strong>{status}</strong>
              <small>
                {i === stage
                  ? "Current demo stage"
                  : i < stage
                    ? "Preview completed"
                    : "Upcoming"}
              </small>
            </li>
          ))}
        </ol>
      </Card>
      <div className="dashboard-columns">
        <Card>
          <CardHeading
            title="Readiness checklist"
            description="Simple UI checks for this demonstration."
          />
          <div className="readiness-list">
            {[
              {
                title: "Election configuration is valid",
                detail: "Title, dates, and leadership offices",
                okay: validConfig,
                icon: Settings2,
              },
              {
                title: "Approved candidates for every office",
                detail: "At least one approved candidate per selected office",
                okay: approved,
                icon: Users,
              },
              {
                title: "Verified demo voters available",
                detail: "At least one fictional eligibility record",
                okay: verified,
                icon: ShieldCheck,
              },
            ].map((item) => (
              <div key={item.title}>
                <span className={`icon-box ${item.okay ? "green" : "yellow"}`}>
                  <item.icon size={20} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small className="muted">{item.detail}</small>
                </span>
                <Badge tone={item.okay ? "green" : "yellow"}>
                  {item.okay ? "Ready" : "Review"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="next-stage">
          <span className="icon-box blue">
            <Settings2 size={24} />
          </span>
          <h2>{next ? `Next: ${next}` : "Demo lifecycle complete"}</h2>
          <p className="muted">
            {next === "Certified"
              ? "Complete the fictional certification checklist to preview the final stage."
              : next
                ? "Confirm the transition to preview the next stage of the election process."
                : "You have explored every stage. Reset the demo from the banner to start again."}
          </p>
          {next === "Certified" ? (
            <ButtonLink href="/committee/results">
              Open certification preview
              <ArrowRight size={17} />
            </ButtonLink>
          ) : (
            next && (
              <Button disabled={!canAdvance} onClick={() => setConfirm(true)}>
                Preview {next.toLowerCase()} stage
                <ArrowRight size={17} />
              </Button>
            )
          )}
          {!ready && stage < 2 && (
            <p className="field-error">
              Complete the readiness checklist before advancing.
            </p>
          )}
        </Card>
      </div>
      <ConfirmationDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Preview the ${next} stage?`}
        description="This is a local interface simulation. No real election is affected."
        onConfirm={() => {
          if (next && canAdvance) {
            demo.setElection((prev) => ({ ...prev, status: next }));
            demo.log(`Demo election moved to ${next}.`);
          }
        }}
        label="Confirm demo transition"
      />
    </>
  );
}
