"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { signInSchema } from "@/lib/schemas";
import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  Logo,
  Modal,
  Notice,
  PageHeader,
} from "../ui";

export function SignIn() {
  const [visible, setVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [forgot, setForgot] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: "", password: "" },
  });
  return (
    <div className="auth-page">
      <header className="welcome-header">
        <Logo />
        <Link className="text-link" href="/">
          <ArrowLeft size={16} />
          Back to welcome
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-copy">
          <p className="eyebrow">UCSA / STUDENT PORTAL</p>
          <h1>
            A community
            <br />
            that starts
            <br />
            with <span>you.</span>
          </h1>
          <p>
            Connect with the people and ideas shaping student life at UNILAK.
          </p>
          <span className="hero-values">UNITY · INNOVATION · PROGRESS</span>
        </div>
        <Card className="auth-card">
          <Badge tone="yellow">Phase 1 · Interface preview</Badge>
          <h2>Welcome back.</h2>
          <p className="muted">Explore your student election experience.</p>
          <Notice>
            This form demonstrates validation only. Authentication is not
            connected. Please don’t enter real credentials.
          </Notice>
          <form
            className="stack"
            noValidate
            onSubmit={handleSubmit(() =>
              setFeedback(
                "Authentication is not available in Phase 1. Use the clearly labeled demo entry below.",
              ),
            )}
          >
            <label className="field">
              Email or registration number
              <input
                autoComplete="off"
                placeholder="e.g. DEMO-2026-001"
                {...register("identifier")}
                aria-label="Email or registration number"
                aria-invalid={!!errors.identifier}
                aria-describedby={
                  errors.identifier ? "identifier-error" : undefined
                }
              />
              {errors.identifier && (
                <span
                  className="field-error"
                  id="identifier-error"
                  role="alert"
                >
                  {errors.identifier.message}
                </span>
              )}
            </label>
            <label className="field">
              Password
              <span className="password-field">
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Use fictional text only"
                  {...register("password")}
                  aria-label="Password"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
              {errors.password && (
                <span className="field-error" id="password-error" role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>
            <button
              type="button"
              className="text-link forgot-link"
              onClick={() => setForgot(true)}
            >
              Forgot password?
            </button>
            <Button type="submit">
              Preview form validation
              <ArrowRight size={17} />
            </Button>
            {feedback && (
              <p className="field-error" role="alert">
                {feedback}
              </p>
            )}
          </form>
          <div className="auth-demo-entry">
            <span className="muted small">NO ACCOUNT REQUIRED</span>
            <ButtonLink href="/student" secondary>
              Enter student demo
              <ArrowRight size={17} />
            </ButtonLink>
            <Link href="/committee" className="text-link small">
              Explore committee demo
              <ArrowRight size={14} />
            </Link>
          </div>
          <p className="muted small auth-footnote">
            <ShieldCheck size={15} />
            <Link href="/account/sign-in">Sign in to your secure Phase 2 account</Link>
          </p>
        </Card>
      </main>
      <Modal
        open={forgot}
        onOpenChange={setForgot}
        title="Password recovery preview"
        description="Real account recovery is available in the secure Phase 2 sign-in flow."
      >
        <Notice>
          No reset message is sent in this demo. You can explore the student
          portal without an account.
        </Notice>
        <div className="dialog-actions">
          <ButtonLink href="/account/reset-password" secondary>
            Reset a secure account password
          </ButtonLink>
          <ButtonLink href="/student">
            Enter student demo
            <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </Modal>
    </div>
  );
}

export function DemoAccount() {
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="STUDENT / DEMO ACCOUNT"
        title="Your place in the community."
        description="A fictional student profile for exploring the Phase 1 experience."
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <Avatar name={demo.student.name} large />
          <h2>{demo.student.name}</h2>
          <Badge tone="green">Verified demo profile</Badge>
          <p className="muted">UNILAK · Computing & IT</p>
        </Card>
        <div className="stack">
          <Card>
            <CardHeading title="Demo profile information" />
            <dl className="details-list">
              <div>
                <dt>Registration</dt>
                <dd>{demo.student.registration}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{demo.student.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{demo.student.phone}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>Student · Non-production demo access</dd>
              </div>
            </dl>
          </Card>
          <Notice>
            The verified badge is a fictional UI state. It does not establish
            real identity, enrollment, or voting eligibility.
          </Notice>
          <Card>
            <CardHeading title="Explore another perspective" />
            <p className="muted">
              Switch to the committee to review applications, verify sample
              voters, and preview election controls.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/committee">
                Open committee demo
                <ArrowRight size={17} />
              </ButtonLink>
              <Button variant="secondary" onClick={() => setOpen(true)}>
                About demo data
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your data in this preview"
        description="All state is kept in memory for this browser session."
      >
        <p>
          Profiles use fictional names and reserved example.test email
          addresses. Applications, photo previews, reviews, and configuration
          reset on reload. Ballot choices are cleared on completion and never
          sent to a server, logged, stored in browser storage, or counted.
        </p>
      </Modal>
    </>
  );
}
