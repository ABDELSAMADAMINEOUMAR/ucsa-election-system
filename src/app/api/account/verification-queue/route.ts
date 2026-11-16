import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/bounded-body";
import { queueSchema } from "@/lib/schemas/bulk";
import { errorResponse, requireApiUser, sameOrigin, safeErrorResponse } from "@/lib/supabase/http";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return errorResponse(403, "Request origin is not allowed.");
  const auth = await requireApiUser(); if (auth.error || !auth.session) return auth.error;
  const parsed = queueSchema.safeParse(await readBoundedJson(request));
  if (!parsed.success) return errorResponse(400, "Check the queue filters.");
  const { page, size, search, status } = parsed.data;
  const { data, error } = await auth.session.client.rpc("review_verification_queue", { page_input: page, size_input: size, search_input: search, status_input: status });
  if (error) return error.message.includes("Not authorized") ? errorResponse(403, "Verification access is required.") : safeErrorResponse(error);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
