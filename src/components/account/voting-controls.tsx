"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Notice, PageHeader } from "@/components/ui";

type Election = { id: string; title: string; status: string; voting_start: string; voting_end: string; election_offices: { id: string; title: string; is_active: boolean }[]; participation: { eligible_band: string; participation_band: string; withheld: boolean } | null };
export function ElectionVotingControls({ elections }: { elections: Election[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(""); const [error, setError] = useState("");
  async function control(election: Election, action: "open" | "close") {
    const message = action === "open" ? `Open voting for “${election.title}”? The action is recorded and the office/candidate configuration freezes.` : `Close voting for “${election.title}”? This prevents any further submission.`;
    if (!window.confirm(`${message}\n\nThis is a local Phase 3 demonstration, not a real UCSA election.`)) return;
    setBusy(election.id); setError("");
    try {
      const response = await fetch(`/api/account/elections/${election.id}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Election control failed."); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Election control failed."); }
    finally { setBusy(""); }
  }
  return <main className="container stack account-workspace"><Link href="/account/committee" className="text-link"><ArrowLeft size={16}/> Committee workspace</Link><PageHeader eyebrow="ELECTION ADMINISTRATION" title="Voting controls" description="Trusted database functions enforce state transitions, schedule boundaries, and election scope. Every action requires a fresh authorized session."/><Notice tone="yellow"><ShieldCheck/> Phase 3 implementation is local and non-production. Do not open a real election. Voting controls do not expose candidate totals or ballot selections.</Notice>
    {error && <p role="alert" className="field-error">{error}</p>}
    {elections.map((election) => <Card className="secure-record" key={election.id}><div className="secure-record-title"><div><h2>{election.title}</h2><p><Clock3 size={15}/> {new Date(election.voting_start).toLocaleString("en-RW",{timeZone:"Africa/Kigali"})} – {new Date(election.voting_end).toLocaleString("en-RW",{timeZone:"Africa/Kigali"})}</p></div><Badge tone={election.status === "open" ? "green" : "blue"}>{election.status}</Badge></div><p>Offices: {election.election_offices.filter((office) => office.is_active).map((office) => office.title).join(", ") || "No active offices"}</p>{election.status === "prepared" && <Button disabled={!!busy} onClick={() => void control(election,"open")}>{busy === election.id ? "Opening…" : "Open voting window"}</Button>}{election.status === "open" && <Button variant="secondary" disabled={!!busy} onClick={() => void control(election,"close")}>{busy === election.id ? "Closing…" : "Close voting"}</Button>}{election.status === "closed" && <><p className="muted">Voting is closed. Candidate totals are withheld until the scheduled end time.</p>{election.participation && <Notice>{election.participation.withheld ? "Participation summary withheld because the eligible group is small." : `Post-window participation bands · Eligible: ${election.participation.eligible_band} · Participated: ${election.participation.participation_band}`}</Notice>}</>}</Card>)}
    {!elections.length && <Card><h2>No elections configured</h2><Link className="text-link" href="/account/committee/elections">Configure an election <ArrowRight size={16}/></Link></Card>}
  </main>;
}
