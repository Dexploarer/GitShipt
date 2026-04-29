import { Buffer } from "node:buffer";
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
 *   1. Generate a per-request CSP nonce and pass it through request headers.
 *   2. Set the matching enforced response CSP. Production script-src has no
 *      'unsafe-inline'; development keeps React's required 'unsafe-eval'.
 *   3. Send unauthenticated requests to /dashboard/* to /auth/signin?next=...
 *   4. Strip `x-middleware-subrequest` if a client tries to set it (defense
 *      in depth).
 */
const isDev = process.env.NODE_ENV !== "production";

const connectSrc = [
  "'self'",
  "https://api.github.com",
  "https://github.com",
  "https://*.bags.fm",
  "https://public-api-v2.bags.fm",
  "https://api.devnet.solana.com",
  "https://api.testnet.solana.com",
  "https://api.mainnet-beta.solana.com",
  "https://*.helius-rpc.com",
  "https://*.helius.xyz",
  "https://*.upstash.io",
  "https://*.redislabs.com",
  "https://*.supabase.co",
  "https://*.neon.tech",
  "https://*.vercel.app",
  "https://vitals.vercel-insights.com",
  "https://va.vercel-scripts.com",
  "wss:",
].join(" ");

const imgSrc = [
  "'self'",
  "data:",
  "https://github.com",
  "https://*.githubusercontent.com",
  "https://avatars.githubusercontent.com",
  "https://opengraph.githubassets.com",
  "https://*.bags.fm",
  "https://*.solana.com",
  "https://arweave.net",
  "https://*.arweave.net",
  "https://ipfs.io",
  "https://*.ipfscdn.io",
  "https://shdw-drive.genesysgo.net",
].join(" ");

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function buildContentSecurityPolicy({
  nonce,
  isEmbed,
}: {
  nonce: string;
  isEmbed: boolean;
}) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    `frame-ancestors ${isEmbed ? "*" : "'none'"}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function setCspHeader(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({
    nonce,
    isEmbed: pathname.startsWith("/embed"),
  });

  // Defense in depth against CVE-2025-29927 even though our auth is in-route.
  const incoming = new Headers(req.headers);
  if (incoming.get("x-middleware-subrequest")) {
    incoming.delete("x-middleware-subrequest");
  }
  incoming.set("x-nonce", nonce);
  incoming.set("Content-Security-Policy", csp);

  // Better-auth session cookie name follows the default convention.
  const hasSession =
    Boolean(req.cookies.get("better-auth.session_token")) ||
    Boolean(req.cookies.get("__Secure-better-auth.session_token"));

  if (pathname.startsWith("/dashboard")) {
    if (!hasSession) {
      const signin = url.clone();
      signin.pathname = "/auth/signin";
      signin.searchParams.set("next", pathname + url.search);
      return setCspHeader(NextResponse.redirect(signin), csp);
    }
  }

  // /admin pages are loaded only after the route handler revalidates the
  // session and confirms the global role. We do nothing extra here so the
  // route's own revalidation is the security boundary.

  return setCspHeader(
    NextResponse.next({ request: { headers: incoming } }),
    csp,
  );
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
