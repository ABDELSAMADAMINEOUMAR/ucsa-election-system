"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="standalone-state" role="alert">
      <p className="eyebrow">UCSA / SOMETHING WENT WRONG</p>
      <h1>Let’s try that again.</h1>
      <p className="muted">
        This page couldn’t be displayed. Try again or return to the welcome page.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/">
        Return to welcome
      </Link>
    </div>
  );
}
