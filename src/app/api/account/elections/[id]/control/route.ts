import { readBoundedJson } from "@/lib/bounded-body";
import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, requireApiUser, sameOrigin } from "@/lib/supabase/http";

const schema = z.object({ action: z.enum(["open", "close"]) }).strict();
const uuid = z.string().uuid();
export async function POST(request: NextRequest, { params }: RouteContext<"/api/account/elections/[id]/control">) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const { id } = await params; if (!uuid.safeParse(id).success) return errorResponse(400, "Invalid election.");
  let body: unknown; try { body = await readBoundedJson(request); } catch { return errorResponse(400, "Invalid request."); }
  const parsed = schema.safeParse(body); if (!parsed.success) return errorResponse(400, "Invalid election action.");
  const { error } = await auth.session.client.rpc(parsed.data.action === "open" ? "open_election" : "close_election", { election_id_input: id });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "Not authorized for this election.") : errorResponse(409, `This election cannot be ${parsed.data.action === "open" ? "opened" : "closed"}.`);
  return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}

