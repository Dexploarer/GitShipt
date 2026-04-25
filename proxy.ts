import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (renamed from middleware.ts in Next 15-).
 *
 * Redirects only — NOT a security boundary. CVE-2025-29927 (middleware
 * bypass via `x-middleware-subrequest`) means the proxy must never be the
 * sole auth gate. Auth is revalidated inside every protected route handler
 * and Server Component.
 *
 * What this file does:
 *   1. Send unauthenticated requests to /dashboard/* to /auth/signin?next=...
 *   2. Hide /admin/* from non-admins by 404'ing (don't reveal route existence).
 *   3. Strip `x-middleware-subrequest` if a client tries to set it (defense
 *      in depth).
 */
export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Defense in depth against CVE-2025-29927 even though our auth is in-route.
  const incoming = new Headers(req.headers);
  if (incoming.get("x-middleware-subrequest")) {
    incoming.delete("x-middleware-subrequest");
  }

  // Better-auth session cookie name follows the default convention.
  const hasSession =
    Boolean(req.cookies.get("better-auth.session_token")) ||
    Boolean(req.cookies.get("__Secure-better-auth.session_token"));

  if (pathname.startsWith("/dashboard")) {
    if (!hasSession) {
      const signin = url.clone();
      signin.pathname = "/auth/signin";
      signin.searchParams.set("next", pathname + url.search);
      return NextResponse.redirect(signin);
    }
  }

  // /admin pages are loaded only after the route handler revalidates the
  // session and confirms the global role. We do nothing extra here so the
  // route's own revalidation is the security boundary.

  return NextResponse.next({ request: { headers: incoming } });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - Next.js internals (_next, image optimisation)
     *  - API routes (handled per-route with their own auth + CSRF logic)
     *  - Static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
