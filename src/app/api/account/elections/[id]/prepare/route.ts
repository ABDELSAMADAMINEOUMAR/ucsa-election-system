import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse,requireApiUser,sameOrigin } from "@/lib/supabase/http";

export async function POST(request:NextRequest,{params}:RouteContext<"/api/account/elections/[id]/prepare">){
 if(!sameOrigin(request)) return errorResponse(403,"Request origin is not allowed.");
 const auth=await requireApiUser(); if(auth.error||!auth.session) return auth.error;
 const {id}=await params; if(!z.uuid().safeParse(id).success) return errorResponse(400,"Invalid election.");
 const {error}=await auth.session.client.rpc("prepare_election",{election_id_input:id});
 if(error) return error.message.includes("Not authorized")?errorResponse(403,"Not authorized for this election."):errorResponse(409,"This election is not ready to prepare.");
 return NextResponse.json({ok:true});
}
