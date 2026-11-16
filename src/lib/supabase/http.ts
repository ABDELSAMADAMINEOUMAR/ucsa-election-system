import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "./auth";
import { isSupabaseConfigured } from "./shared";

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function sameOrigin(request: NextRequest) {
  const supplied = request.headers.get("origin");
  const expectedHost = request.headers.get("host");
  const expectedProtocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.slice(0, -1);
  if (!supplied || !expectedHost) return false;
  try {
    const origin = new URL(supplied);
    return (
      origin.host.toLowerCase() === expectedHost.toLowerCase() &&
      origin.protocol.slice(0, -1) === expectedProtocol
    );
  } catch {
    return false;
  }
}

export async function requireApiUser() {
  if (!isSupabaseConfigured())
    return {
      error: errorResponse(503, "Secure services are not configured."),
      session: null,
    };
  const session = await getAuthenticatedUser();
  if (!session)
    return {
      error: errorResponse(401, "Please sign in to continue."),
      session: null,
    };
  const [binding, committee] = await Promise.all([
    session.client.rpc("has_student_access"),
    session.client
      .from("committee_members")
      .select("role")
      .eq("user_id", session.user.id)
      .limit(1),
  ]);
  if (binding.data !== true && !committee.data?.length)
    return {
      error: errorResponse(
        403,
        "Activate your account against the approved register first.",
      ),
      session: null,
    };
  return { error: null, session };
}

export async function isCommitteeRole(client: SupabaseClient, roles: string[]) {
  const { data, error } = await client
    .from("committee_members")
    .select("role")
    .in("role", roles)
    .limit(1);
  return !error && Boolean(data?.length);
}

export function safeErrorResponse(error: unknown) {
  void error;
  return errorResponse(
    500,
    "The request could not be completed. Please try again.",
  );
}
