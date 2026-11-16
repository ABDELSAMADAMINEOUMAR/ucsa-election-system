"use client";
import Link from "next/link";
import { Button } from "@/components/ui";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <main className="account-workspace stack">
      <h1>Workspace unavailable</h1>
      <p role="alert">
        The requested records could not be loaded. No decision has been inferred
        from this error. Check the connection and try again.
      </p>
      <div className="account-actions">
        <Button onClick={reset}>Try again</Button>
        <Link href="/account" className="text-link">
          Return to your account
        </Link>
      </div>
    </main>
  );
}
