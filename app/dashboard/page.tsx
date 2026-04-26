import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Coins,
  FolderGit2,
  Rocket,
  Wallet,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { hasCredentials } from "@/lib/env";
import {
  getMyProjects,
  getMyEarnings,
  getMyLinkedWallets,
  type MyProjectRow,
} from "@/lib/queries/dashboard";
import { formatSol } from "@/lib/format";
import { AppShell } from "./_components/AppShell";
import { DashboardSidebar } from "@/components/sidebar/DashboardSidebar";
import { StatTile } from "@/components/shared/StatTile";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Dashboard root — overview of all projects the user owns or admins.
 *
 * CVE-2025-29927 mitigation: re-validates the session inside the Server
 * Component even though `proxy.ts` already redirects unauthenticated traffic.
 */
export default async function DashboardPage() {
  if (!hasCredentials.db()) return <DashboardStub />;

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/signin?next=/dashboard");

  const userId = session.user.id;
  const [projects, earnings, wallets] = await Promise.all([
    getMyProjects(userId),
    getMyEarnings(userId),
    getMyLinkedWallets(userId),
  ]);

  return (
    <AppShell
      sidebar={<DashboardSidebar active="overview" />}
      footerLeft={`${session.user.name ?? session.user.email} · devnet · BAGS.fm`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-lg leading-tight text-fg">
              Welcome back, {session.user.name ?? session.user.email}
            </h1>
            <p className="text-body-md text-fg-secondary">
              Your projects, earnings, and linked wallets — all in one place.
            </p>
          </div>
          <Button asChild variant="primary" size="default">
            <Link href="/launch">
              <Rocket className="size-4" /> Launch a token
            </Link>
          </Button>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="My Projects"
            value={projects.length.toString()}
            icon={FolderGit2}
            sub={`${projects.filter((p) => p.status === "live").length} live`}
          />
          <StatTile
            label="Lifetime Fees Earned"
            value={formatSol(earnings.totalLifetimeLamports, 4)}
            icon={Coins}
            accent="primary"
          />
          <StatTile
            label="Pending Escrow"
            value={formatSol(earnings.pendingEscrowLamports, 4)}
            icon={Sparkles}
          />
          <StatTile
            label="Wallets Linked"
            value={wallets.length.toString()}
            icon={Wallet}
            sub={
              wallets.find((w) => w.isPrimary) ? "Primary set" : "No primary"
            }
          />
        </section>

        <section>
          <Card depth="flat" padding="none">
            <CardHeader className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>My Projects</CardTitle>
                  <CardDescription>
                    Repositories you own or co-administer.
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/projects">View all</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Rocket}
                    title="Launch your first token"
                    description="Connect a GitHub repo, mint a Bags.fm token, and start rewarding contributors with on-chain SOL — daily."
                    cta={{ label: "Launch a token", href: "/launch" }}
                    secondary={{ label: "Browse projects", href: "/" }}
                  />
                </div>
              ) : (
                <ProjectList rows={projects.slice(0, 8)} />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

export function ProjectList({ rows }: { rows: MyProjectRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((p) => (
        <li
          key={p.id}
          className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-6 py-3 transition-colors hover:bg-surface-elevated/40"
        >
          <Avatar src={p.imageUrl} alt={p.slug} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-label-md text-fg">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <div className="text-mono-sm text-fg-muted truncate">{p.slug}</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-mono-sm text-fg-secondary">
              {p.contributorsCount}
            </div>
            <div className="text-caption text-fg-muted">contributors</div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-mono-sm text-primary">
              {formatSol(p.lifetimeFeesLamports, 4)}
            </div>
            <div className="text-caption text-fg-muted">lifetime</div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/dashboard/projects/${p.id}`}>
              Open <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <span className="grid size-10 place-items-center rounded-full bg-surface-elevated text-label-sm text-fg-muted">
        {alt.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className="size-10 rounded-full border border-border object-cover"
    />
  );
}

export function StatusBadge({
  status,
}: {
  status: "draft" | "live" | "paused" | "killed";
}) {
  const map = {
    live: { variant: "success" as const, label: "Live", dot: true },
    draft: { variant: "default" as const, label: "Draft", dot: false },
    paused: { variant: "warning" as const, label: "Paused", dot: false },
    killed: { variant: "danger" as const, label: "Killed", dot: false },
  } as const;
  const v = map[status];
  return (
    <Badge variant={v.variant} size="sm" dot={v.dot}>
      {v.label}
    </Badge>
  );
}

/**
 * Stub-mode page — DB unavailable, no real data. Shown when DATABASE_URL is
 * unset.
 */
function DashboardStub() {
  return (
    <AppShell sidebar={<DashboardSidebar active="overview" />}>
      <div className="mx-auto w-full max-w-content">
        <EmptyState
          icon={Sparkles}
          title="Stub mode"
          description="Set DATABASE_URL to bring the dashboard online. Once Neon Postgres + GitHub OAuth are configured, your projects, earnings, and wallets will populate here."
          cta={{ label: "Sign in", href: "/auth/signin" }}
        />
      </div>
    </AppShell>
  );
}
