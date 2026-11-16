import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/account/:path*", "/api/account/:path*"],
};
