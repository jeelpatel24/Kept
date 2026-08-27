// Session refresh + creator-route protection. Implements: TRD-5.1 (Supabase Auth for creators).
// Guest share route (/s/*) and its API are public by design (PRD-F8).
//
// Hardened against MIDDLEWARE_INVOCATION_TIMEOUT (TRD-4.4 applies to us too):
//  1. Public paths never touch Supabase at all.
//  2. No auth cookie → redirect/401 immediately, zero network.
//  3. The one remaining getUser() call has a hard 5s timeout; on timeout the user is sent to
//     /login rather than the whole site returning a 504.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/auth", "/s/", "/api/share/", "/api/health", "/api/reminders/run", "/_next", "/favicon", "/manifest", "/icon"];
const AUTH_CHECK_TIMEOUT_MS = 5_000;

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

function deny(request: NextRequest, reason?: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  if (reason) url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  // webcal subscription must be fetchable by calendar apps without cookies (TRD-3.8) — it carries its own signed token.
  const isCalendarFeed = /^\/api\/notes\/[^/]+\/calendar\.ics$/.test(pathname) && request.nextUrl.searchParams.has("t");
  if (isPublic || isCalendarFeed) return NextResponse.next();

  // Protected path with no session cookie: decide locally, never call out.
  if (!hasSupabaseAuthCookie(request)) return deny(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("auth check timed out")), AUTH_CHECK_TIMEOUT_MS)),
    ]);
    if (!result.data.user) return deny(request);
  } catch {
    // Auth backend unreachable/slow: fail closed for the request, not the whole site.
    return deny(request, "auth_unreachable");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
