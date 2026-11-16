import Link from "next/link";
import { HelpForm } from "@/components/account/help-form";
import { Logo, PageHeader } from "@/components/ui";
export default function Help() { return <main className="container stack account-workspace"><Logo/><PageHeader eyebrow="UCSA SUPPORT" title="Help and register corrections" description="Support requests never grant account access or election eligibility automatically."/><HelpForm/><Link className="text-link" href="/account/sign-in">Return to sign in</Link></main>; }
