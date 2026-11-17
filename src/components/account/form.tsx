"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, Logo, Notice } from "@/components/ui";

type Mode = "sign-in" | "register" | "reset" | "new-password";
const config = {
  "sign-in": {
    title: "Welcome back.",
    description: "Sign in to your secure student account.",
    endpoint: "/api/account/sign-in",
    action: "Sign in",
    fields: ["email", "password"],
  },
  register: {
    title: "Create your account.",
    description:
      "Use the registration number and email on the approved UCSA register.",
    endpoint: "/api/account/register",
    action: "Create account",
    fields: ["registrationNumber", "email", "password"],
  },
  reset: {
    title: "Reset your password.",
    description: "We will send a reset link if this account exists.",
    endpoint: "/api/account/password-reset",
    action: "Send reset link",
    fields: ["email"],
  },
  "new-password": {
    title: "Choose a new password.",
    description: "Use at least 12 characters with a letter and a number.",
    endpoint: "/api/account/password-update",
    action: "Update password",
    fields: ["password"],
  },
} as const;

export function AccountForm({
  mode,
  registrationEnabled = true,
  invalidRecoveryLink = false,
}: {
  mode: Mode;
  registrationEnabled?: boolean;
  invalidRecoveryLink?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const current = config[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(current.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { error?: string; message?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The request could not be completed.");
        return;
      }
      // Auth changes server cookies. Start a fresh document so cached RSC
      // identity and a competing router refresh cannot strand this transition.
      if (mode === "sign-in") {
        window.location.replace("/account");
        return;
      }
      if (mode === "new-password") {
        window.location.replace("/account/sign-in?notice=password-updated");
        return;
      }
      setMessage(data.message ?? "Your request is complete.");
    } catch {
      setError("Connection issue. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="welcome-header">
        <Logo />
        <Link className="text-link" href="/">
          <ArrowLeft size={16} /> Back to welcome
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-copy">
          <p className="eyebrow">UCSA / SECURE ACCOUNT</p>
          <h1>
            A community
            <br />
            that starts
            <br />
            with <span>you.</span>
          </h1>
          <p>
            Verified access for UNILAK students and authorized committee
            members.
          </p>
          <span className="hero-values">UNITY · INNOVATION · PROGRESS</span>
        </div>
        <Card className="auth-card">
          <Badge tone="blue">UCSA secure account</Badge>
          <h2>{current.title}</h2>
          <p className="muted">{current.description}</p>
          {mode === "reset" || mode === "new-password" ? (
            <Notice>
              Recover your existing UCSA student or committee account.
              Registration and a student registration number are not required to
              reset a password. Open the newest email link in the same browser
              where you requested it.
            </Notice>
          ) : (
            <Notice>
              Email confirmation and an approved register match are required for
              student access. Creating an account never grants committee
              privileges.
            </Notice>
          )}
          {invalidRecoveryLink && (
            <Notice tone="yellow">
              This reset link is invalid, expired, already used, or was opened
              in a different browser. Request a new link below and open it in
              this browser.
            </Notice>
          )}
          {mode === "register" && !registrationEnabled ? (
            <div className="stack">
              <Notice tone="yellow">
                Online student registration is currently closed. It will open
                after the system is approved for student access.
              </Notice>
              <Link className="text-link" href="/account/sign-in">
                Go to secure sign in <ArrowRight size={15} />
              </Link>
            </div>
          ) : null}
          {message ? (
            <div role="status">
              <Notice tone="green">
                <CheckCircle2 size={17} /> {message}
              </Notice>
            </div>
          ) : registrationEnabled || mode !== "register" ? (
            <form className="stack" onSubmit={submit}>
              {current.fields.map((field) => (
                <label className="field" key={field}>
                  {field === "registrationNumber"
                    ? "UNILAK registration number"
                    : field === "email"
                      ? mode === "reset"
                        ? "Account email"
                        : "Student email"
                      : "Password"}
                  <span
                    className={
                      field === "password" ? "password-field" : undefined
                    }
                  >
                    <input
                      required
                      name={field}
                      type={
                        field === "password"
                          ? showPassword
                            ? "text"
                            : "password"
                          : field === "email"
                            ? "email"
                            : "text"
                      }
                      autoComplete={
                        field === "password"
                          ? mode === "sign-in"
                            ? "current-password"
                            : "new-password"
                          : field === "email"
                            ? "email"
                            : "off"
                      }
                      minLength={
                        field === "password" && mode !== "sign-in"
                          ? 12
                          : undefined
                      }
                      maxLength={
                        field === "registrationNumber"
                          ? 40
                          : field === "email"
                            ? 254
                            : 128
                      }
                      placeholder={
                        field === "registrationNumber"
                          ? "Your official registration number"
                          : field === "email"
                            ? mode === "reset"
                              ? "Your existing account email"
                              : "Email on the approved register"
                            : "12+ characters, letter and number"
                      }
                    />
                    {field === "password" && (
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    )}
                  </span>
                </label>
              ))}
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : null}
                {busy ? "Please wait…" : current.action}
                <ArrowRight size={17} />
              </Button>
            </form>
          ) : null}
          {message ? (
            <div className="auth-demo-entry">
              <Link className="text-link" href="/account/sign-in">
                Return to secure sign in <ArrowRight size={15} />
              </Link>
            </div>
          ) : null}
          {message && mode === "register" && registrationEnabled ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
                setShowPassword(false);
              }}
            >
              Return to registration form
            </Button>
          ) : null}
          {mode === "sign-in" && (
            <div className="auth-demo-entry">
              <Link href="/account/reset-password" className="text-link small">
                Forgot password?
              </Link>
              {registrationEnabled && (
                <>
                  <span className="muted small">NEW TO UCSA?</span>
                  <Link href="/account/register" className="text-link">
                    Create a student account <ArrowRight size={15} />
                  </Link>
                </>
              )}
            </div>
          )}
          {mode === "register" && (
            <p className="muted small auth-footnote">
              <ShieldCheck size={15} /> Your official name is shown only after
              secure account activation.
            </p>
          )}
          {(mode === "reset" || mode === "new-password") && !message && (
            <Link className="text-link" href="/account/sign-in">
              Back to sign in
            </Link>
          )}
          <Link className="text-link" href="/help">
            {mode === "reset" || mode === "new-password"
              ? "Need help accessing your account?"
              : "Need help or a register correction?"}
          </Link>
          {mode !== "reset" && mode !== "new-password" && (
            <div className="auth-demo-entry">
              <Link className="text-link small" href="/sign-in">
                Return to Phase 1 demo entry
              </Link>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

export function SecureSignOut() {
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string>("");
  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/sign-out", { method: "POST" });
      if (!response.ok)
        throw new Error("Sign out could not be completed. Please try again.");
      window.location.replace("/account/sign-in");
    } catch {
      setSignOutError("Sign out could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      {signOutError && (
        <span role="alert" className="field-error">
          {signOutError}
        </span>
      )}
      <Button
        variant="secondary"
        type="button"
        onClick={signOut}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </span>
  );
}
