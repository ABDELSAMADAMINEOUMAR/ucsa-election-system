import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { isPublicRegistrationEnabled } from "@/lib/registration-policy";
import { Logo } from "./ui";
export function Welcome() {
  const registrationEnabled = isPublicRegistrationEnabled();
  return (
    <div className="public-home">
      <a className="skip-link" href="#welcome-main">
        Skip to content
      </a>
      <header className="container public-home-header">
        <Logo />
        <nav aria-label="Main navigation">
          <Link href="/help">Help</Link>
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
            Access-controlled tools for UCSA committee management, including
            membership administration, candidate review, complaints, and
            certification workflows.
          </p>
          <div className="account-actions">
            <Link className="btn btn-primary" href="/account/sign-in">
              Sign in <ArrowRight size={18} />
            </Link>
            {registrationEnabled ? (
              <Link className="btn btn-secondary" href="/account/register">
                Create an account
              </Link>
            ) : null}
          </div>
        </section>
        <section
          className="public-home-steps"
          aria-label="Management capabilities"
        >
          <article>
            <Users />
            <h2>Membership administration</h2>
            <p>
              Authorized committee members can manage the approved register and
              account activation through restricted workflows.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h2>Candidate review</h2>
            <p>
              Review candidate applications and decisions within the protected
              management workspace.
            </p>
          </article>
          <article>
            <FileCheck2 />
            <h2>Complaints and certification</h2>
            <p>
              Support case handling, audit review, and election certification
              records for authorized committee roles.
            </p>
          </article>
        </section>
        <section className="public-home-support">
          <h2>Need help accessing the system?</h2>
          <p>
            Contact the UCSA committee about account activation, access, or
            system availability.
          </p>
          <Link className="text-link" href="/help">
            Get help
          </Link>
        </section>
      </main>
      <footer className="container public-home-footer">
        UCSA · Chadian Students Association · UNILAK, Kigali
      </footer>
    </div>
  );
}
