import Link from "next/link";
import { HelpForm } from "@/components/account/help-form";
import { PageHeader } from "@/components/ui";
export default function StudentHelp() {
  return (
    <main className="account-workspace stack">
      <PageHeader
        eyebrow="STUDENT SUPPORT"
        title="Help"
        description="Get assistance with your register entry, account, or election access."
      />
      <HelpForm />
      <Link className="text-link" href="/account/student/complaints">
        Submit or track a private election complaint
      </Link>
    </main>
  );
}
