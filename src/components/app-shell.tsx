"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  House,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessageSquareWarning,
  PanelLeftClose,
  Settings2,
  ShieldCheck,
  Users,
  UserRound,
  Vote,
  X,
} from "lucide-react";
import { Avatar, ConfirmationDialog, Logo, Modal } from "./ui";
import { useDemo } from "./demo-provider";

const studentNav = [
  { label: "Home", href: "/student", icon: House },
  { label: "Candidates", href: "/student/candidates", icon: Users },
  { label: "My application", href: "/student/apply", icon: ClipboardList },
  { label: "Voting demo", href: "/student/vote", icon: Vote },
  { label: "Published results", href: "/student/results", icon: BarChart3 },
  { label: "Demo account", href: "/student/profile", icon: UserRound },
];
const committeeNav = [
  { label: "Overview", href: "/committee", icon: LayoutDashboard },
  { label: "Voter verification", href: "/committee/voters", icon: ShieldCheck },
  { label: "Candidate review", href: "/committee/candidates", icon: Users },
  { label: "Election setup", href: "/committee/elections", icon: CalendarDays },
  { label: "Election controls", href: "/committee/controls", icon: Settings2 },
  {
    label: "Complaints",
    href: "/committee/complaints",
    icon: MessageSquareWarning,
  },
  {
    label: "Results & certification",
    href: "/committee/results",
    icon: CheckCheck,
  },
  { label: "Reports", href: "/committee/reports", icon: FileText },
];

export function AppShell({
  role,
  children,
}: {
  role: "student" | "committee";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const demo = useDemo();
  const { notice, setNotice } = demo;
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const nav = role === "student" ? studentNav : committeeNav;
  const activePath =
    pathname === "/student/application-status" ? "/student/apply" : pathname;
  const current = [...nav]
    .reverse()
    .find(
      (item) =>
        activePath === item.href ||
        (item.href !== `/${role}` && activePath.startsWith(`${item.href}/`)),
    );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  function renderNavigation() {
    return (
      <>
        <div className="sidebar-brand">
          <Logo />
          <span className="portal-label">
            {role === "committee" ? "COMMITTEE WORKSPACE" : "STUDENT PORTAL"}
          </span>
        </div>
        <nav className="side-nav" aria-label={`${role} navigation`}>
          {nav.map((item) => {
            const active =
              item.href === `/${role}`
                ? activePath === item.href
                : activePath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobile(false)}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.label === "Complaints" && (
                  <span className="nav-count">
                    {demo.complaints.filter((c) => c.status === "New").length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <GraduationCap size={24} />
            <strong>
              One community.
              <br />A shared future.
            </strong>
            <span>UNITY · INNOVATION · PROGRESS</span>
          </div>
          <button
            className="nav-item"
            onClick={() => {
              setHelp(true);
              setMobile(false);
            }}
          >
            <LifeBuoy size={19} />
            Help & information
          </button>
          <Link className="nav-item" href="/">
            <LogOut size={19} />
            Leave demo workspace
          </Link>
        </div>
      </>
    );
  }
  return (
    <div className="app-frame">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">{renderNavigation()}</aside>
      <Modal
        open={mobile}
        onOpenChange={setMobile}
        title="Navigation"
        description="Choose a page in the demo workspace."
      >
        <div className="mobile-drawer">{renderNavigation()}</div>
      </Modal>
      <div className="workspace">
        <header className="app-header">
          <div className="header-left">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <PanelLeftClose className="desktop-only muted" size={19} />
            <span className="header-divider desktop-only" />
            <span className="muted header-breadcrumb">
              {role === "committee" ? "Committee" : "Student portal"}
            </span>
            <ChevronRight size={14} className="muted" />
            <strong>{current?.label || "Overview"}</strong>
          </div>
          <div className="header-actions">
            <span className="demo-pill">
              <span />
              DEMO WORKSPACE
            </span>
            <Link
              className="role-switch"
              href={role === "student" ? "/committee" : "/student"}
              title="Switch demo role"
            >
              <ArrowLeftRight size={16} />
              <span>
                {role === "student" ? "Committee view" : "Student view"}
              </span>
            </Link>
            <Link href="/student/profile" aria-label="View demo account">
              <Avatar
                name={role === "student" ? demo.student.name : "Demo Committee"}
              />
            </Link>
          </div>
        </header>
        <div className="demo-ribbon">
          <span>
            <BookOpen size={14} />
            <strong>Phase 1 preview</strong>
            <span className="ribbon-detail">
              Fictional data. All actions are local simulations.
            </span>
          </span>
          <button onClick={() => setReset(true)}>Reset demo</button>
        </div>
        <main id="main-content" className="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>© 2026 UCSA · UNILAK Chadian Students Association</span>
          <span>
            Designed for a stronger community <span className="footer-dot" />
          </span>
        </footer>
      </div>
      {role === "student" && (
        <nav className="bottom-nav" aria-label="Student quick navigation">
          {studentNav.slice(0, 5).map((item) => (
            <Link
              href={item.href}
              key={item.href}
              aria-current={
                (
                  item.href === "/student"
                    ? activePath === item.href
                    : activePath.startsWith(item.href)
                )
                  ? "page"
                  : undefined
              }
            >
              <item.icon size={20} />
              <span>
                {item.label === "My application"
                  ? "Apply"
                  : item.label === "Published results"
                    ? "Results"
                    : item.label === "Voting demo"
                      ? "Vote demo"
                      : item.label}
              </span>
            </Link>
          ))}
        </nav>
      )}
      <div className="toast-area" role="status" aria-live="polite">
        {demo.notice && (
          <div className="toast">
            <CheckCheck size={19} />
            <span>{demo.notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => demo.setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="About this workspace"
        description="UCSA Election Management System · Phase 1"
      >
        <p>
          This interactive frontend uses fictional people, sample results, and
          memory-only state. Reloading the page resets the demo. No real
          election, authentication, or vote recording is connected.
        </p>
        <p className="mt-4">
          Use the role switcher to explore student and committee journeys.
          Voting demonstrations never change candidate totals. All times use
          Kigali time (CAT, UTC+2).
        </p>
        <p className="mt-4 small muted">
          The official UCSA mark is displayed from the original project asset.
          The demo experience remains fictional and separate from secure account
          and election services.
        </p>
      </Modal>
      <ConfirmationDialog
        open={reset}
        onOpenChange={setReset}
        title="Reset the demo workspace?"
        description="This clears this session’s simulated applications, reviews, configuration, and ballot selections. Only fictional demo state is affected."
        onConfirm={demo.reset}
        label="Reset demo"
      >
        <p className="muted small">
          You can also reload the page to start a fresh demo.
        </p>
      </ConfirmationDialog>
    </div>
  );
}
