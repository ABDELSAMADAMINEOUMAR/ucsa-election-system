import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reconcile") }),
  z.object({ action: z.literal("approve"), reconciliationId: z.string().uuid(), reason: z.string().max(1000).optional() }),
  z.object({ action: z.literal("reject"), reconciliationId: z.string().uuid(), reason: z.string().min(3).max(1000) }),
  z.object({ action: z.literal("certify"), reconciliationId: z.string().uuid() }),
  z.object({ action: z.literal("publish"), certificationId: z.string().uuid(), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("correction"), certificationId: z.string().uuid(), reason: z.string().min(10).max(2000), note: z.string().min(5).max(2000) }),
  z.object({ action: z.literal("configure_policy"), requiredApprovals: z.number().int().min(1).max(5), policyReference: z.string().trim().min(5).max(500), complaintsRequired: z.boolean(), allowReopen: z.boolean() }),
]);
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/account/elections/[id]/certification">) {
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; const { data, error } = await auth.session.client.rpc("get_certification_workspace", { election_id_input: id });
  if (error) return errorResponse(403, "Certification workspace is unavailable.");
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/elections/[id]/certification">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; const parsed = schema.safeParse(await readBoundedJson(request)); if (!parsed.success) return errorResponse(400, "The requested election action is invalid.");
  const input = parsed.data; let data: unknown = null; let error: { message: string } | null = null;
  if (input.action === "reconcile") ({ data, error } = await auth.session.client.rpc("reconcile_election_results", { election_id_input: id }));
  else if (input.action === "certify") ({ data, error } = await auth.session.client.rpc("certify_election_results", { election_id_input: id, reconciliation_id_input: input.reconciliationId }));
  else if (input.action === "publish") ({ data, error } = await auth.session.client.rpc("publish_certified_election_results", { election_id_input: id, certification_id_input: input.certificationId, note_input: input.note ?? "" }));
  else if (input.action === "correction") ({ data, error } = await auth.session.client.rpc("record_certification_correction", { election_id_input: id, certification_id_input: input.certificationId, reason_input: input.reason, note_input: input.note }));
  else if (input.action === "configure_policy") ({ data, error } = await auth.session.client.rpc("configure_election_certification_policy", { election_id_input: id, approvals_input: input.requiredApprovals, reference_input: input.policyReference, complaints_required_input: input.complaintsRequired, allow_reopen_input: input.allowReopen }));
  else ({ data, error } = await auth.session.client.rpc("record_certification_approval", { election_id_input: id, reconciliation_id_input: input.reconciliationId, decision_input: input.action === "approve" ? "approved" : "rejected", reason_input: input.reason ?? "" }));
  if (error) return errorResponse(400, "The election action was rejected or its prerequisites are not satisfied.");
  return NextResponse.json({ result: data }, { headers: { "Cache-Control": "private, no-store" } });
}
