import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "GitBags — Pump.fm for open source",
    template: "%s · GitBags",
  },
  description:
    "Launch a Bags.fm token for any GitHub repo. Daily fees redistribute to the top contributors.",
  applicationName: "GitBags",
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
    siteName: "GitBags",
    title: "GitBags — Pump.fm for open source",
    description:
      "Launch a Bags.fm token for any GitHub repo. Daily fees redistribute to the top contributors.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-bg text-fg antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
