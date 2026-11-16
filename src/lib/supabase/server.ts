import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./shared";

export async function createSupabaseServerClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/",
            }),
          );
        } catch {
          // Server Components cannot write cookies. Proxy refreshes sessions.
        }
      },
    },
  });
}
