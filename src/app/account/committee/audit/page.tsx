import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireCommitteeRole } from "@/lib/supabase/auth";

export default async function Page() {
  await connection();
  const { client }=await requireCommitteeRole(["committee_chair","election_administrator"]);
  const {data,error}=await client.from("admin_audit_events").select("id,action,entity_type,entity_id,election_id,reason,created_at").order("created_at",{ascending:false}).limit(100);
  if(error) throw new Error("The audit history is unavailable.");
  return <main className="container stack account-workspace"><Link className="text-link" href="/account/committee"><ArrowLeft size={16}/> Committee workspace</Link><PageHeader eyebrow="ADMINISTRATION / AUDIT" title="Administrative activity" description="Recent access controlled decisions. Passwords, tokens, and ballot selections are never recorded."/>
    {(data??[]).map((event)=><Card className="secure-record" key={event.id}><div className="secure-record-title"><History/><div><h2>{event.action.replaceAll("_"," ")}</h2><p>{event.entity_type.replaceAll("_"," ")} · {event.entity_id??""}</p></div><Badge>{new Date(event.created_at).toLocaleString()}</Badge></div>{event.reason&&<p>{event.reason}</p>}{event.election_id&&<p className="muted small">Election {event.election_id}</p>}</Card>)}
    {!data?.length&&<Card><h2>No administrative events</h2><p>Roster imports and review decisions are recorded here.</p></Card>}
  </main>;
}


