import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedJson } from "@/lib/bounded-body";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

const content = z.object({ biography: z.string().trim().min(30).max(1000), manifesto: z.string().trim().min(80).max(5000), consent: z.literal(true) }).strict();

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/account/applications/[id]">) {
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return errorResponse(400, "Invalid application.");
  const { data, error } = await auth.session.client.from("candidate_applications").select("id,status").eq("id", id).eq("user_id", auth.session.user.id).maybeSingle();
  if (error) return safeErrorResponse(error);
  if (!data) return errorResponse(404, "Application unavailable.");
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/account/applications/[id]">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (auth.error || !auth.session) return auth.error;
  const { id } = await params;
  const parsed = content.safeParse(await readBoundedJson(request));
  if (!z.uuid().safeParse(id).success || !parsed.success) return errorResponse(400, "Check your biography, manifesto and consent.");
  const { error } = await auth.session.client.rpc("update_candidate_draft", { application_id_input: id, biography_input: parsed.data.biography, manifesto_input: parsed.data.manifesto });
  if (error) return errorResponse(409, "Only your eligible draft can be edited during nominations.");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
