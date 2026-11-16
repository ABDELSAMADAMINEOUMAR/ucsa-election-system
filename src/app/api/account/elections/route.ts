import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { secureElectionSchema } from "@/lib/schemas/account";
import { errorResponse, requireApiUser, safeErrorResponse, sameOrigin, isCommitteeRole } from "@/lib/supabase/http";

export async function GET() {
  const auth=await requireApiUser(); if(auth.error||!auth.session) return auth.error;
  if(!(await isCommitteeRole(auth.session.client,["election_administrator","committee_chair"]))) return errorResponse(403,"Not authorized.");
  const {data,error}=await auth.session.client.from("elections").select("id,title,description,status,nominations_start,nominations_end,voting_start,voting_end,election_offices!election_offices_election_id_fkey(id,title,display_order)").order("created_at",{ascending:false});
  if(error) return safeErrorResponse(error);
  return NextResponse.json({elections:data},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return errorResponse(403,"Request origin is not allowed.");
  const auth=await requireApiUser(); if(auth.error||!auth.session) return auth.error;
  const parsed=secureElectionSchema.safeParse(await readBoundedJson(request));
  if(!parsed.success) return errorResponse(400,parsed.error.issues[0]?.message??"Check the election schedule.");
  const plusKigaliOffset=(value:string)=>`${value}+02:00`;
  const election={...parsed.data,nominationsStart:plusKigaliOffset(parsed.data.nominationsStart),nominationsEnd:plusKigaliOffset(parsed.data.nominationsEnd),votingStart:plusKigaliOffset(parsed.data.votingStart),votingEnd:plusKigaliOffset(parsed.data.votingEnd)};
  const {data,error}=await auth.session.client.rpc("create_election",{election_input:election});
  if(error) return error.message.includes("Not authorized")?errorResponse(403,"Not authorized to configure elections."):errorResponse(400,"Election configuration is invalid.");
  return NextResponse.json({id:data},{status:201});
}
