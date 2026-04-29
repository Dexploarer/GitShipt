import type { NextConfig } from "next";

/**
 * Shared headers — applied to every route.
 * CSP and X-Frame-Options vary per source (embed routes need to be iframe-able).
 * CSP is generated in proxy.ts so Next.js can attach per-request nonces during
 * SSR. Keeping it out of next.config avoids a second static policy that would
 * conflict with the nonce policy.
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
      // Default — X-Frame-Options DENY for everything except /embed/*.
      // Negative lookahead in the path matcher excludes /embed paths so the
      // dedicated embed entry below isn't shadowed.
      {
        source: "/:path((?!embed).*)",
        headers: [
          ...sharedSecurityHeaders,
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      // Embed routes — no X-Frame-Options; proxy.ts sets frame-ancestors *.
      {
        source: "/embed/:path*",
        headers: [...sharedSecurityHeaders],
      },
    ];
  },
};

export default nextConfig;
