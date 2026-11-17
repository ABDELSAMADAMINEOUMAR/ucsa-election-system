import { NextRequest } from "next/server";
import { completeAuthCallback } from "@/lib/supabase/callback";

export async function GET(request: NextRequest) {
  return completeAuthCallback(
    request,
    "/account/reset-password/new",
    "/account/reset-password?notice=link-invalid",
  );
}
