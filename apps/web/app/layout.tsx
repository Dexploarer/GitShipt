import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";
import { SessionChromeProvider } from "@/components/auth/SessionChromeProvider";
import { SkipLink } from "@/components/shared/SkipLink";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-app-gradient text-fg antialiased">
        <SkipLink />
        <ThemeProvider>
          <SessionChromeProvider user={user}>
            <SolanaWalletProvider>
              <div>{children}</div>
            </SolanaWalletProvider>
          </SessionChromeProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
