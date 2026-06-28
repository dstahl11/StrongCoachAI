import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Keep in sync with SESSION_COOKIE in src/lib/auth/session.ts. (Inlined because
// middleware runs on the edge runtime and can't import the pg-backed module.)
const SESSION_COOKIE = "sc_session";

/**
 * Coarse gate: redirect to /login when no session cookie is present. Real
 * validation happens server-side via getCurrentUser(). The cron endpoint is
 * skipped (it authenticates with CRON_SECRET).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/coach/tick")) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except Next internals and static asset files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)",
  ],
};
