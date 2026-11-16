import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest,NextResponse } from "next/server";
import { committeeMemberSchema } from "@/lib/schemas/account";
import { errorResponse,requireApiUser,sameOrigin,safeErrorResponse,isCommitteeRole } from "@/lib/supabase/http";

export async function GET(){
 const auth=await requireApiUser(); if(auth.error||!auth.session) return auth.error;
 if(!(await isCommitteeRole(auth.session.client,["committee_chair"]))) return errorResponse(403,"Not authorized.");
 const {data,error}=await auth.session.client.from("committee_members").select("user_id,role,election_id,created_at").order("created_at",{ascending:false});
 if(error) return safeErrorResponse(error);
 return NextResponse.json({members:data},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:NextRequest){
 if(!sameOrigin(request)) return errorResponse(403,"Request origin is not allowed.");
 const auth=await requireApiUser(); if(auth.error||!auth.session) return auth.error;
 const parsed=committeeMemberSchema.safeParse(await readBoundedJson(request));
 if(!parsed.success) return errorResponse(400,"Check the account ID, role, and election scope.");
 const {error}=await auth.session.client.rpc("manage_committee_member",{user_id_input:parsed.data.userId,role_input:parsed.data.role,election_id_input:parsed.data.electionId,action_input:parsed.data.action});
 if(error) return error.message.includes("Not authorized")?errorResponse(403,"Only an authorized committee chair may manage committee roles."):errorResponse(409,"Committee access could not be updated. Check the account and existing role.");
 return NextResponse.json({ok:true});
}
