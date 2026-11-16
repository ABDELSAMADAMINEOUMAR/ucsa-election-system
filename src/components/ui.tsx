"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Inbox,
  Search,
  X,
} from "lucide-react";
import { initials } from "@/lib/utils";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`btn btn-${secondary ? "secondary" : "primary"}`}
      href={href}
    >
      {children}
    </Link>
  );
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const text = String(children);
  const color =
    tone ||
    (["Approved", "Verified", "Resolved", "Certified"].includes(text)
      ? "green"
      : ["Rejected", "Ineligible", "Closed"].includes(text)
        ? "red"
        : ["Pending", "New", "Draft", "Pending certification"].includes(text)
          ? "yellow"
          : "blue");
  return (
    <span className={`badge badge-${color}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export { UcsaBrand as Logo } from "./branding";
export function Avatar({
  name,
  photo,
  large = false,
}: {
  name: string;
  photo?: string;
  large?: boolean;
}) {
  return (
    <span className={`avatar ${large ? "avatar-large" : ""}`}>
      {photo ? (
        <Image
          src={photo}
          alt={`${name} — demo portrait`}
          width={large ? 96 : 44}
          height={large ? 96 : 44}
          unoptimized
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  back,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <div className="page-heading">
      {back && (
        <Link className="back-link" href={back}>
          <ArrowLeft size={16} />
          Back
        </Link>
      )}
      <div className="heading-row">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        {action && <div className="heading-action">{action}</div>}
      </div>
    </div>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function CardHeading({
  title,
  description,
  href,
  link = "View all",
}: {
  title: string;
  description?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {description && <p className="muted small">{description}</p>}
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {link}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <Card className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`icon-box ${tone}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p className="muted small">{detail}</p>
    </Card>
  );
}
export function EmptyState({
  title = "No matches found",
  description = "Try a different search or reset your filters.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="icon-box blue">
        <Inbox size={26} />
      </span>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={18} />
      <span className="sr-only">{placeholder}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </label>
  );
}
export function FilterControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="filter-control">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const restoreFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onOpenAutoFocus={() => {
            restoreFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            if (restoreFocus.current?.isConnected) {
              event.preventDefault();
              restoreFocus.current.focus();
            }
          }}
        >
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="muted">
            {description}
          </Dialog.Description>
          <Dialog.Close className="dialog-close" aria-label="Close dialog">
            <X size={20} />
          </Dialog.Close>
          <div className="dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  label = "Confirm simulation",
  children,
  danger = false,
  disabled = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  label?: string;
  children?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      {children}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={disabled}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {label}
        </Button>
      </div>
    </Modal>
  );
}
export function Notice({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "yellow" | "green";
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <span className="notice-symbol">
        {tone === "green" ? (
          <Check size={18} />
        ) : (
          <span aria-hidden="true">i</span>
        )}
      </span>
      <div>{children}</div>
    </div>
  );
}
export function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="quick-link">
      <span className="icon-box blue">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small className="muted">{description}</small>
      </span>
      <ArrowUpRight size={18} />
    </Link>
  );
}
