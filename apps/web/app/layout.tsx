import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";
import { SessionChromeProvider } from "@/components/auth/SessionChromeProvider";
import { Toaster } from "@/components/providers/Toaster";
import { SkipLink } from "@/components/shared/SkipLink";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

// Reading the per-request CSP nonce via headers() opts the layout into
// dynamic rendering. With Next 16 cacheComponents enabled, route-segment
// `dynamic = "force-dynamic"` is forbidden — caching is opt-in per function
// via the `'use cache'` directive. Layouts that read headers() are
// inherently dynamic, and the cache decision lives inside the data-fetch
// helpers in lib/queries/* where each function picks a `cacheLife` profile
// and emits its tags. Public pages still get edge cache via the cached
// query's revalidate window; the surrounding layout shell renders fresh
// per request so the nonce is always per-response.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "GitShipt — tokenize your repo, pay your contributors",
    template: "%s · GitShipt",
  },
  description:
    "GitShipt turns any GitHub repo into a tradeable Bags.fm token. Swap fees fund a daily on-chain SOL payout to the top contributors — automatic, transparent, no committee.",
  applicationName: "GitShipt",
  authors: [{ name: "SYMBiEX" }],
  keywords: [
    "Solana",
    "Bags.fm",
    "GitHub",
    "open source",
    "token launch",
    "leaderboard",
    "contributor payouts",
  ],
  openGraph: {
    type: "website",
    siteName: "GitShipt",
    title: "GitShipt — tokenize your repo, pay your contributors",
    description:
      "GitShipt turns any GitHub repo into a tradeable Bags.fm token. Swap fees fund a daily on-chain SOL payout to the top contributors — automatic, transparent, no committee.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

/**
 * Cache Components ('use cache' / cacheComponents=true) requires every
 * uncached data fetch in a Server Component to live inside a Suspense
 * boundary. The root layout reads the per-request CSP nonce from
 * `headers()` and resolves the better-auth session — both are dynamic.
 * We defer those awaits into `<RootLayoutShell>` and wrap that in a
 * Suspense so the static `<html>`/`<body>` shell can prerender while the
 * dynamic providers stream in.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-app-gradient text-fg antialiased">
        <SkipLink />
        <Suspense fallback={null}>
          <RootLayoutShell>{children}</RootLayoutShell>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}

async function RootLayoutShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, headerList] = await Promise.all([
    getSessionUser(),
    headers(),
  ]);
  const nonce = headerList.get("x-nonce") ?? undefined;

  return (
    <ThemeProvider nonce={nonce}>
      <SessionChromeProvider user={user}>
        <SolanaWalletProvider>
          <div>{children}</div>
        </SolanaWalletProvider>
      </SessionChromeProvider>
      <Toaster />
    </ThemeProvider>
  );
}
