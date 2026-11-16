import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/applications/[id]/submit">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse(400, "Invalid application.");
  const { error } = await auth.session.client.rpc("submit_candidate_application", { application_id_input: id });
  if (error) return errorResponse(409, "This application cannot be submitted. Check your eligibility and the nomination period.");
  return NextResponse.json({ ok: true });
}
