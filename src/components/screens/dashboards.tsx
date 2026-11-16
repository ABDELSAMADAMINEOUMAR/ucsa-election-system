"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  FileText,
  Megaphone,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardHeading,
  Notice,
  PageHeader,
  QuickLink,
  Stat,
} from "../ui";
import { formatDate, formatTime, percent } from "@/lib/utils";

export function ElectionSummary({ student = false }: { student?: boolean }) {
  const { election } = useDemo();
  return (
    <section className="election-banner">
      <div className="banner-copy">
        <p className="eyebrow">OUR COMMUNITY. OUR FUTURE.</p>
        <div className="banner-title">
          <h2>{election.title}</h2>
          <Badge>{election.status}</Badge>
        </div>
        <p>{election.description}</p>
        <div className="banner-meta">
          <span>
            <CalendarDays size={16} />
            {formatDate(election.votingStart)}
          </span>
          <span>
            <Clock3 size={16} />
            {formatTime(election.votingStart)} –{" "}
            {formatTime(election.votingEnd)} CAT
          </span>
          <span>
            <Users size={16} />
            {election.offices.length} leadership offices
          </span>
        </div>
        <ButtonLink
          secondary
          href={student ? "/student/candidates" : "/committee/controls"}
        >
          {student ? "Meet the candidates" : "Manage election"}
          <ArrowRight size={16} />
        </ButtonLink>
      </div>
      <div className="banner-art" aria-hidden="true">
        <div className="banner-art-ring" />
        <Vote size={72} strokeWidth={1.2} />
        <span>
          YOUR VOICE
          <br />
          <strong>SHAPES TOMORROW.</strong>
        </span>
      </div>
    </section>
  );
}

export function Schedule() {
  const { election } = useDemo();
  const items = [
    { title: "Nominations open", date: election.nominationsStart, done: true },
    { title: "Applications close", date: election.nominationsEnd, done: false },
    { title: "Election day", date: election.votingStart, done: false },
  ];
  return (
    <Card>
      <CardHeading
        title="Election timeline"
        description="Plan ahead · All times in CAT"
      />{" "}
      <ol className="timeline">
        {items.map((item, i) => (
          <li key={item.title} className={item.done ? "done" : ""}>
            <span className="timeline-node">
              {item.done ? <Check size={13} /> : i + 1}
            </span>
            <div>
              <strong>{item.title}</strong>
              <span className="muted small">{formatDate(item.date)}</span>
            </div>
            {i === 0 && <Badge tone="blue">Sample schedule</Badge>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function CommitteeDashboard() {
  const { voters, candidates, complaints, activity } = useDemo();
  const verified = voters.filter((v) => v.status === "Verified").length;
  const pending = candidates.filter((c) => c.status === "Pending").length;
  return (
    <>
      <PageHeader
        eyebrow="COMMITTEE WORKSPACE"
        title="Election overview"
        description="A clear view of your election, from preparation to participation."
        action={
          <ButtonLink href="/committee/reports" secondary>
            <FileText size={17} />
            View reports
          </ButtonLink>
        }
      />
      <ElectionSummary />
      <div className="stats-grid">
        <Stat
          label="Registered voters"
          value={voters.length}
          detail="Fictional student records"
          icon={<Users size={20} />}
        />
        <Stat
          label="Verified voters"
          value={verified}
          detail={`${percent(verified, voters.length)}% of the sample register`}
          icon={<ShieldCheck size={20} />}
          tone="green"
        />
        <Stat
          label="Candidate applications"
          value={candidates.length}
          detail={`${pending} awaiting your review`}
          icon={<ClipboardCheck size={20} />}
          tone="yellow"
        />
        <Stat
          label="Open complaints"
          value={complaints.filter((c) => c.status !== "Resolved").length}
          detail="Simulated cases to follow up"
          icon={<MessageSquareWarning size={20} />}
          tone="red"
        />
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <Card>
            <CardHeading
              title="Needs your attention"
              description="Keep the next stage moving forward."
            />
            <div className="attention-row">
              <span className="icon-box yellow">
                <ClipboardCheck size={21} />
              </span>
              <div>
                <strong>{pending} applications to review</strong>
                <p className="muted small">
                  Help our next student leaders take the first step.
                </p>
              </div>
              <Link
                aria-label="Review candidate applications"
                href="/committee/candidates"
              >
                <ArrowUpRight size={20} />
              </Link>
            </div>
            <div className="attention-row">
              <span className="icon-box blue">
                <ShieldCheck size={21} />
              </span>
              <div>
                <strong>
                  {voters.filter((v) => v.status === "Pending").length} students
                  awaiting verification
                </strong>
                <p className="muted small">
                  Review eligibility before preparing the election.
                </p>
              </div>
              <Link aria-label="Review pending voters" href="/committee/voters">
                <ArrowUpRight size={20} />
              </Link>
            </div>
            <div className="attention-row">
              <span className="icon-box red">
                <MessageSquareWarning size={21} />
              </span>
              <div>
                <strong>
                  {complaints.filter((c) => c.status === "New").length} new
                  complaint to review
                </strong>
                <p className="muted small">
                  A responsive process builds community trust.
                </p>
              </div>
              <Link aria-label="Review complaints" href="/committee/complaints">
                <ArrowUpRight size={20} />
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeading
              title="Candidate applications"
              href="/committee/candidates"
            />
            <div className="compact-list">
              {candidates.slice(0, 4).map((c) => (
                <Link
                  className="person-row"
                  href={`/committee/candidates/${c.id}`}
                  key={c.id}
                >
                  <Avatar name={c.name} photo={c.photo} />
                  <span>
                    <strong>{c.name}</strong>
                    <small className="muted">{c.office}</small>
                  </span>
                  <Badge>{c.status}</Badge>
                  <ArrowUpRight className="muted" size={17} />
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Schedule />
          <Card>
            <CardHeading
              title="Voter readiness"
              description="Verification progress · Demo register"
            />
            <div className="readiness">
              <div
                className="donut"
                style={
                  {
                    "--progress": `${percent(verified, voters.length)}%`,
                  } as React.CSSProperties
                }
              >
                <span>
                  <strong>{percent(verified, voters.length)}%</strong>
                  <small>verified</small>
                </span>
              </div>
              <div className="legend">
                <span>
                  <i className="legend-blue" />
                  Verified<strong>{verified}</strong>
                </span>
                <span>
                  <i className="legend-yellow" />
                  Pending
                  <strong>
                    {voters.filter((v) => v.status === "Pending").length}
                  </strong>
                </span>
                <span>
                  <i className="legend-gray" />
                  Ineligible
                  <strong>
                    {voters.filter((v) => v.status === "Ineligible").length}
                  </strong>
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="dashboard-columns">
        <Card>
          <CardHeading
            title="Recent activity"
            description="Fictional activity from this demo session."
          />
          <div className="activity-list">
            {activity.length ? (
              activity.slice(0, 4).map((a) => (
                <div key={a.id}>
                  <span className="activity-dot" />
                  <span>
                    <strong>{a.text}</strong>
                    <small className="muted">{a.time}</small>
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">
                Your next simulated action will appear here.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeading title="Quick actions" />
          <QuickLink
            href="/committee/elections"
            icon={<CalendarDays size={19} />}
            title="Set up your election"
            description="Dates, offices, and key details"
          />
          <QuickLink
            href="/committee/controls"
            icon={<Vote size={19} />}
            title="Preview the election workflow"
            description="Move through the demo lifecycle"
          />
        </Card>
      </div>
    </>
  );
}

export function StudentDashboard() {
  const demo = useDemo();
  const application = demo.candidates.find((c) => c.id === demo.applicationId);
  return (
    <>
      <PageHeader
        eyebrow="YOUR STUDENT PORTAL"
        title="Hello, Mariam 👋"
        description="Your community. Your ideas. Your chance to shape what comes next."
        action={<Badge tone="green">Verified demo student</Badge>}
      />
      <ElectionSummary student />
      <div className="student-status-grid">
        <Card className="student-status">
          <span className="icon-box green">
            <ShieldCheck size={22} />
          </span>
          <div>
            <strong>You’re ready to participate</strong>
            <p className="muted small">
              Your fictional profile is verified for this preview.
            </p>
          </div>
        </Card>
        <Card className="student-status">
          <span className="icon-box yellow">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <strong>
              {application
                ? `Application ${application.status.toLowerCase()}`
                : "Have a vision for UCSA?"}
            </strong>
            <Link
              className="text-link small"
              href={
                application ? "/student/application-status" : "/student/apply"
              }
            >
              {application ? "Track your application" : "Explore candidacy"}
              <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
        <Card className="student-status">
          <span className="icon-box blue">
            <Vote size={22} />
          </span>
          <div>
            <strong>Try the voting experience</strong>
            <Link className="text-link small" href="/student/vote">
              Open the demonstration ballot
              <ArrowRight size={14} />
            </Link>
          </div>
        </Card>
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <Card>
            <CardHeading
              title="A voice for our community"
              description="Get to know the approved demo candidates."
              href="/student/candidates"
              link="Explore candidates"
            />
            <div className="featured-candidates">
              {demo.candidates
                .filter((c) => c.status === "Approved")
                .slice(0, 3)
                .map((c) => (
                  <Link key={c.id} href={`/student/candidates/${c.id}`}>
                    <Avatar name={c.name} photo={c.photo} large />
                    <strong>{c.name}</strong>
                    <span className="muted small">{c.office}</span>
                    <span className="text-link small">
                      View profile
                      <ArrowUpRight size={14} />
                    </span>
                  </Link>
                ))}
            </div>
          </Card>
          <Card>
            <CardHeading title="Community announcements" />
            <div className="announcement">
              <span className="icon-box yellow">
                <Megaphone size={20} />
              </span>
              <div>
                <span className="eyebrow">SAMPLE ANNOUNCEMENT · 6 NOV</span>
                <h3>Leadership starts with an idea.</h3>
                <p className="muted">
                  Candidate nominations are part of this preview. Explore the
                  application journey and share a fictional vision for the
                  association.
                </p>
              </div>
            </div>
            <div className="announcement">
              <span className="icon-box blue">
                <Sparkles size={20} />
              </span>
              <div>
                <h3>A transparent process, step by step.</h3>
                <p className="muted">
                  Published sample results are available in a separate fictional
                  completed election. The current election remains a local
                  simulation.
                </p>
              </div>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Schedule />
          <Card className="callout-card">
            <Vote size={28} />
            <h2>Your voice matters.</h2>
            <p className="muted">
              Practice selecting candidates and reviewing your ballot. No vote
              is stored, counted, or submitted.
            </p>
            <ButtonLink href="/student/vote">
              Try the voting demo
              <ArrowRight size={16} />
            </ButtonLink>
          </Card>
        </div>
      </div>
      <Notice>
        All profiles, schedules, and announcements are fictional. This portal
        does not verify real student eligibility.
      </Notice>
    </>
  );
}
