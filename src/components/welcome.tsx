import Link from "next/link";
import { ArrowRight, ShieldCheck, Users, Vote } from "lucide-react";
import { Logo, Notice } from "./ui";
export function Welcome() {
  return (
    <div className="public-home">
      <a className="skip-link" href="#welcome-main">
        Skip to content
      </a>
      <header className="container public-home-header">
        <Logo />
        <nav aria-label="Main navigation">
          <Link href="/help">Help</Link>
          <Link className="btn btn-secondary" href="/account/sign-in">
            Secure sign in
          </Link>
        </nav>
      </header>
      <main id="welcome-main" className="container stack">
        <section className="public-home-hero">
          <p className="eyebrow">
            CHADIAN STUDENTS ASSOCIATION · UNILAK, KIGALI
          </p>
          <h1>
            Your voice.
            <br />
            Your UCSA elections.
          </h1>
          <p>
            One approved membership register. Clear account activation. A simple
            way to follow candidates and participate when you are eligible.
          </p>
          <div className="account-actions">
            <Link className="btn btn-primary" href="/account/register">
              Create an account <ArrowRight size={18} />
            </Link>
            <Link className="btn btn-secondary" href="/account/sign-in">
              Sign in
            </Link>
          </div>
          <Notice tone="yellow">
            Demonstration environment. Use fictional identities only. Real
            electronic voting is disabled pending independent security review.
          </Notice>
        </section>
        <section
          className="public-home-steps"
          aria-label="How student access works"
        >
          <article>
            <Users />
            <h2>Approved membership</h2>
            <p>
              The committee checks membership through the official UCSA
              registration process.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h2>Confirm and activate</h2>
            <p>
              Confirm your email and securely match your official registration
              number. A number alone never grants access.
            </p>
          </article>
          <article>
            <Vote />
            <h2>Participate when eligible</h2>
            <p>
              Follow available positions and apply during nominations. Ballot
              demonstrations use fictional elections only.
            </p>
          </article>
        </section>
        <section className="public-home-support">
          <h2>Need help with your registration?</h2>
          <p>
            Contact the committee about a missing entry, incorrect details or
            account access.
          </p>
          <Link className="text-link" href="/help">
            Request help or a correction
          </Link>
        </section>
        <details className="public-home-demo">
          <summary>Explore the separate fictional demonstration</summary>
          <p>
            These Phase 1 screens use fictional data and do not authenticate
            accounts or manage the protected election.
          </p>
          <div className="account-actions">
            <Link href="/sign-in" className="text-link">
              Student portal demo
            </Link>
            <Link href="/committee" className="text-link">
              Committee demo
            </Link>
            <Link href="/student/results" className="text-link">
              Demo results
            </Link>
          </div>
        </details>
      </main>
      <footer className="container public-home-footer">
        UCSA · Chadian Students Association · UNILAK, Kigali
      </footer>
    </div>
  );
}
