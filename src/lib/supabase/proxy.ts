import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function refreshSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return privateResponse(NextResponse.next({ request }));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    auth: { flowType: "pkce", autoRefreshToken: true, persistSession: true },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          }),
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (
    !data.user &&
    (request.nextUrl.pathname.startsWith("/account/student") ||
      request.nextUrl.pathname.startsWith("/account/committee") ||
      request.nextUrl.pathname === "/account")
  ) {
    const signIn = new URL("/account/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(signIn);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return privateResponse(redirect);
  }
  return privateResponse(response);
}
