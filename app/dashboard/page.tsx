import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Wallet, Github } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Dashboard root — placeholder. Day 2 wires in real KPIs + project list.
 *
 * Per CVE-2025-29927, auth is revalidated INSIDE this Server Component
 * even though proxy.ts also gates the route.
 */
export default async function DashboardPage() {
  // Stub-mode: render a cold-start view explaining what's needed.
  if (!hasCredentials.db()) {
    return <DashboardStub />;
  }

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/signin?next=/dashboard");

  return (
    <main className="mx-auto w-full max-w-content px-margin py-12">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
            <Sparkles className="size-4" />
          </span>
          <h1 className="text-headline-md">Dashboard</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="rounded-lg border border-border bg-surface p-6">
        <p className="text-headline-sm">
          Welcome, {session.user.name ?? session.user.email}.
        </p>
        <p className="mt-2 text-body-md text-fg-secondary">
          Day-1 placeholder. Day 2 wires in your projects, earnings, and alerts.
        </p>
      </section>
    </main>
  );
}

function DashboardStub() {
  return (
    <main className="mx-auto w-full max-w-content px-margin py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
            <Sparkles className="size-4" />
          </span>
          <h1 className="text-headline-md">Dashboard</h1>
        </Link>
        <ThemeToggle />
      </header>
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-headline-sm">Stub mode</h2>
        <p className="mt-2 text-body-md text-fg-secondary">
          The dashboard needs Neon Postgres + GitHub OAuth credentials to come
          online. Once <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-mono-sm">
            DATABASE_URL
          </code>{" "}
          is set the sign-in flow will activate.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg hover:bg-primary-hover"
          >
            <Github className="size-4" /> Try sign-in
          </Link>
          <Link
            href="/auth/wallet"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg hover:bg-surface-overlay"
          >
            <Wallet className="size-4" /> Link wallet
          </Link>
        </div>
      </section>
    </main>
  );
}
