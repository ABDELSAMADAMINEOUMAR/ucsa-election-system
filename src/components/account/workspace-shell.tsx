"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  ShieldCheck,
  Users,
  GraduationCap,
  CalendarDays,
  Vote,
  BarChart3,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import { UcsaBrand } from "@/components/branding";
import { Badge, Button, Modal } from "@/components/ui";
import { SecureSignOut } from "./form";

export const roleLabel = (role: string) => role.replaceAll("_", " ");
export function WorkspaceShell({
  children,
  roles,
  globalRoles = roles,
  name,
  email,
  committee = false,
}: {
  children: ReactNode;
  roles: string[];
  globalRoles?: string[];
  name: string;
  email: string;
  committee?: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const chair = globalRoles.includes("committee_chair");
  const can = (...allowed: string[]) =>
    chair || allowed.some((role) => roles.includes(role));
  const links = committee
    ? [
        {
          href: "/account/committee",
          label: "Dashboard",
          icon: LayoutDashboard,
          show: true,
        },
        {
          href: "/account/committee/roster",
          label: "Voter Register",
          icon: Users,
          show: chair || globalRoles.includes("verification_officer"),
        },
        {
          href: "/account/committee/elections",
          label: "Elections",
          icon: CalendarDays,
          show: can("election_administrator", "verification_officer"),
        },
        {
          href: "/account/committee/candidates",
          label: "Candidates",
          icon: GraduationCap,
          show: can("candidate_review_officer"),
        },
        {
          href: "/account/committee/certification",
          label: "Results and Complaints",
          icon: BarChart3,
          show: can("certifying_officer"),
        },
        {
          href: "/account/committee/administration",
          label: "Administration",
          icon: UserRound,
          show: true,
        },
      ]
    : [
        {
          href: "/account/student",
          label: "Home",
          icon: LayoutDashboard,
          show: true,
        },
        {
          href: "/account/student/vote",
          label: "Elections",
          icon: Vote,
          show: true,
        },
        {
          href: "/account/student/applications",
          label: "Candidates",
          icon: GraduationCap,
          show: true,
        },
        {
          href: "/account/student/settings",
          label: "My Account",
          icon: UserRound,
          show: true,
        },
        {
          href: "/account/student/help",
          label: "Help",
          icon: ShieldCheck,
          show: true,
        },
      ];
  const navigation = (
    <nav
      aria-label={committee ? "Committee navigation" : "Student navigation"}
      className="workspace-nav"
    >
      {links
        .filter((item) => item.show)
        .map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      <Link href="/account" onClick={() => setOpen(false)}>
        <ArrowLeft size={18} />
        Account overview
      </Link>
    </nav>
  );
  return (
    <div className="workspace-shell">
      <a href="#workspace-content" className="skip-link">
        Skip to workspace
      </a>
      <aside className="workspace-sidebar">
        <UcsaBrand />
        <p className="workspace-section-label">
          {committee ? "Committee administration" : "Student portal"}
        </p>
        {navigation}
        <div className="sidebar-footer">
          UNILAK · Kigali
          <br />
          Local testing environment
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <Button
            variant="ghost"
            className="workspace-menu"
            onClick={() => setOpen(true)}
            aria-label="Open workspace navigation"
          >
            <Menu size={22} />
          </Button>
          <div className="workspace-mobile-brand">
            <UcsaBrand compact />
          </div>
          <div className="workspace-account">
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <Badge tone="blue">
            {committee ? roleLabel(roles[0] ?? "committee") : "Student"}
          </Badge>
          <div className="account-header-right">
            <SecureSignOut />
          </div>
        </header>
        <div className="workspace-environment">
          Local rehearsal · Real elections are not enabled
        </div>
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={committee ? "Committee navigation" : "Student navigation"}
        description="Open an authorized workspace."
      >
        <div className="workspace-drawer">
          <UcsaBrand />
          {navigation}
        </div>
      </Modal>
    </div>
  );
}
