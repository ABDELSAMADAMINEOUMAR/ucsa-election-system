import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

const schema = z.object({ action: z.string().min(3).max(40), publicNote: z.string().max(3000).optional(), internalNote: z.string().max(3000).optional(), assignedTo: z.string().uuid().nullable().optional() }).strict();
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/account/complaints/[id]">) {
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; const { data, error } = await auth.session.client.rpc("get_complaint_details", { complaint_id_input: id });
  if (error) return errorResponse(404, "Complaint is unavailable.");
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/complaints/[id]">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; const parsed = schema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Please check the complaint update.");
  const { action, publicNote = "", internalNote = "", assignedTo = null } = parsed.data;
  const isStudentReply = action === "student_reply";
  const { error } = isStudentReply
    ? await auth.session.client.rpc("reply_to_complaint", { complaint_id_input: id, message_input: publicNote })
    : await auth.session.client.rpc("review_complaint", { complaint_id_input: id, action_input: action, public_note_input: publicNote, internal_note_input: internalNote, assigned_to_input: assignedTo });
  if (error) return errorResponse(400, "This complaint update is unavailable or not authorized.");
  return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "private, no-store" } });
}
