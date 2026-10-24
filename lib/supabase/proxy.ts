import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

// Pages anyone can open. Everything else requires sign-in.
const PUBLIC_PATHS = ["/login", "/privacy", "/terms", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Refreshes the Supabase session cookie on every request, sends signed-out
// visitors to /login and new users to /welcome. Pages still check the user
// themselves (lib/auth.ts); this is the fast, optimistic first pass.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Cache headers that stop a CDN from serving one user's cookies to another.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims(): getClaims()
  // verifies the token and refreshes it when it is close to expiring.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { pathname } = request.nextUrl;

  if (!userId) {
    return isPublic(pathname)
      ? response
      : redirectKeepingCookies(request, response, "/login");
  }

  // Send new users to the one-time Welcome page here, before anything
  // renders. Only for page loads: server actions POST to the page URL.
  if (
    request.method === "GET" &&
    (pathname === "/login" || !isPublic(pathname))
  ) {
    const onboarded = await isOnboarded(supabase, request, response, userId);
    if (onboarded === false && pathname !== "/welcome") {
      return redirectKeepingCookies(request, response, "/welcome");
    }
    if (onboarded && (pathname === "/welcome" || pathname === "/login")) {
      return redirectKeepingCookies(request, response, "/");
    }
  }

  // Return this exact response: it carries any refreshed session cookies.
  return response;
}

// Remembers "this user finished Welcome" so the proxy queries the database
// once per browser, not on every request. The value is the user id, so a
// different account signing in on the same browser is checked afresh.
// Not a security check: the (app) layout still verifies onboarding itself.
const ONBOARDED_COOKIE = "studyott-onboarded";

async function isOnboarded(
  supabase: SupabaseClient<Database>,
  request: NextRequest,
  response: NextResponse,
  userId: string,
): Promise<boolean | null> {
  if (request.cookies.get(ONBOARDED_COOKIE)?.value === userId) return true;

  const { data, error } = await supabase
    .from("user_settings")
    .select("onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();
  // Unknown (query failed): don't redirect; the pages decide.
  if (error || !data) return null;
  if (data.onboarded_at === null) return false;

  response.cookies.set(ONBOARDED_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
