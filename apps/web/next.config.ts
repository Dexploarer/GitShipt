import type { NextConfig } from "next";

/**
 * Shared headers — applied to every route.
 * CSP and X-Frame-Options vary per source (embed routes need to be iframe-able).
 */
const sharedSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/**
 * Content-Security-Policy — strict baseline.
 *
 * Notes / TODOs:
 *  - script-src includes 'unsafe-inline' because Next.js emits inline App
 *    Router bootstrap scripts, and next-themes injects an inline theme script.
 *    Next.js 16.2 nonce enforcement must be implemented in proxy.ts by
 *    generating a per-request nonce, forwarding it as x-nonce plus the request
 *    Content-Security-Policy, and setting the same CSP on the response. Next
 *    then parses the request CSP and attaches the nonce during SSR.
 *    Do not partially enforce this here: nonce CSP requires all matching pages
 *    to be dynamically rendered. The current build still prerenders
 *    /auth/signin and /_not-found statically, so a proxy-only nonce would leave
 *    those static shells without nonced framework/theme scripts. Finish this as
 *    a dedicated sweep by opting the remaining document routes into dynamic
 *    rendering, passing x-nonce to ThemeProvider's nonce prop, and only then
 *    removing script 'unsafe-inline' from the enforced policy.
 *    Production also ships a stricter Report-Only policy without script
 *    'unsafe-inline' so it can be smoke-tested before enforce.
 *  - style-src 'unsafe-inline' is for Tailwind's inlined styles + Recharts.
 *  - connect-src lists every external API the app talks to. Add new domains
 *    here when integrating new services.
 *  - frame-ancestors 'none' is the modern equivalent of X-Frame-Options DENY;
 *    /embed/* needs frame-ancestors '*' to be embeddable.
 */
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");
const reportOnlyScriptSrc = [
  "'self'",
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");
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

const cspStrict = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://github.com https://*.githubusercontent.com https://avatars.githubusercontent.com https://opengraph.githubassets.com https://*.bags.fm https://*.solana.com https://arweave.net https://*.arweave.net https://ipfs.io https://*.ipfscdn.io https://shdw-drive.genesysgo.net",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cspReportOnly = [
  "default-src 'self'",
  `script-src ${reportOnlyScriptSrc}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://github.com https://*.githubusercontent.com https://avatars.githubusercontent.com https://opengraph.githubassets.com https://*.bags.fm https://*.solana.com https://arweave.net https://*.arweave.net https://ipfs.io https://*.ipfscdn.io https://shdw-drive.genesysgo.net",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cspReportOnlyEmbed = cspReportOnly.replace(
  "frame-ancestors 'none'",
  "frame-ancestors *",
);

const reportOnlyHeader = isDev
  ? []
  : [{ key: "Content-Security-Policy-Report-Only", value: cspReportOnly }];

const reportOnlyEmbedHeader = isDev
  ? []
  : [
      {
        key: "Content-Security-Policy-Report-Only",
        value: cspReportOnlyEmbed,
      },
    ];

/**
 * Embed CSP — same as strict but allows the page to be framed anywhere.
 * frame-ancestors * is required so third-party sites can embed
 * /embed/r/{org}/{repo} via <iframe>.
 */
const cspEmbed = cspStrict
  .replace("frame-ancestors 'none'", "frame-ancestors *")
  .concat("");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  reactCompiler: true,
  devIndicators: { position: "top-right" },
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@repo/lib", "@repo/shared", "@repo/ui"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "opengraph.githubassets.com" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "*.ipfscdn.io" },
      { protocol: "https", hostname: "shdw-drive.genesysgo.net" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "*.arweave.net" },
    ],
  },

  async headers() {
    return [
      // Default — strict CSP + X-Frame-Options DENY for everything except /embed/*.
      // Negative lookahead in the path matcher excludes /embed paths so the
      // dedicated embed entry below isn't shadowed.
      {
        source: "/:path((?!embed).*)",
        headers: [
          ...sharedSecurityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: cspStrict },
          ...reportOnlyHeader,
        ],
      },
      // Embed routes — relaxed CSP that allows iframing; no X-Frame-Options.
      {
        source: "/embed/:path*",
        headers: [
          ...sharedSecurityHeaders,
          { key: "Content-Security-Policy", value: cspEmbed },
          ...reportOnlyEmbedHeader,
        ],
      },
    ];
  },
};

export default nextConfig;
