"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  ExternalLink,
  GitFork,
  Github,
  Loader2,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { cn } from "@repo/lib";
import {
  ApiErrorResponseSchema,
  GithubReposResponseSchema,
  type GithubInstallationSummary,
  type GithubRepo,
  type GithubReposResponse,
} from "@repo/shared";

export interface RepoPickerProps {
  selectedId: string | null;
  onSelect: (repo: GithubRepo) => void;
}

interface FetchState {
  status: "idle" | "loading" | "success" | "error";
  data: GithubReposResponse | null;
  error: string | null;
}

export function RepoPicker({ selectedId, onSelect }: RepoPickerProps) {
  const [state, setState] = useState<FetchState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/github/me/repos", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const body = ApiErrorResponseSchema.safeParse(
            await res.json().catch(() => null),
          );
          const errorBody = body.success ? body.data : null;
          if (cancelled) return;
          setState({
            status: "error",
            data: null,
            error: friendlyError(
              res.status,
              errorBody?.error,
              errorBody?.message,
            ),
          });
          return;
        }
        const json = (await res.json()) as unknown;
        const parsed = GithubReposResponseSchema.safeParse(json);
        if (cancelled) return;
        if (!parsed.success) {
          setState({
            status: "error",
            data: null,
            error: "GitHub response shape is unexpected. Try again.",
          });
          return;
        }
        setState({ status: "success", data: parsed.data, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: e instanceof Error ? e.message : "Could not load repos.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!state.data) return [] as GithubRepo[];
    const q = query.trim().toLowerCase();
    if (!q) return state.data.repos;
    return state.data.repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [state.data, query]);

  // Group filtered repos by installationId so we can render org-headered
  // sections. Falls back to a single bucket keyed on accountLogin if a
  // repo somehow lacks an installationId (legacy cache responses).
  const grouped = useMemo(() => {
    const buckets = new Map<
      string,
      {
        installation: GithubInstallationSummary | null;
        repos: GithubRepo[];
      }
    >();
    const installationsByKey = new Map<string, GithubInstallationSummary>();
    for (const inst of state.data?.installations ?? []) {
      installationsByKey.set(String(inst.installationId), inst);
    }

    for (const repo of filtered) {
      const key = repo.installationId
        ? String(repo.installationId)
        : (repo.accountLogin ?? repo.owner);
      const existing = buckets.get(key);
      if (existing) {
        existing.repos.push(repo);
      } else {
        buckets.set(key, {
          installation: installationsByKey.get(key) ?? null,
          repos: [repo],
        });
      }
    }
    return Array.from(buckets.values());
  }, [filtered, state.data]);

  const appSlug = state.data?.appSlug;
  const installNewUrl = appSlug
    ? `https://github.com/apps/${appSlug}/installations/new`
    : null;
  const installations = state.data?.installations ?? [];
  const hasNoInstallations =
    state.status === "success" && installations.length === 0;
  const showSearchAndList =
    state.status === "success" && installations.length > 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-headline-sm">Pick a repository</h2>
        <p className="text-body-md text-fg-secondary">
          Choose the GitHub repo to back this token. We verify your admin
          permission server-side at launch.
        </p>
        {state.status === "success" ? (
          <p className="text-body-sm text-fg-muted">
            {hasNoInstallations
              ? "No GitHub App installations yet"
              : `Showing repos from ${installations.length} installation${
                  installations.length === 1 ? "" : "s"
                }`}
          </p>
        ) : null}
        {state.data?.visibilityNote ? (
          <p className="rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-body-sm text-fg-muted">
            {state.data.visibilityNote}
          </p>
        ) : null}
      </header>

      {state.status === "loading" ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-3 text-body-sm text-fg-secondary">
          <Loader2 className="size-4 animate-spin" />
          Loading your repositories...
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="flex items-start gap-3 rounded-md border border-danger bg-danger-soft p-3 text-body-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {hasNoInstallations ? (
        <EmptyInstallationsCard installNewUrl={installNewUrl} />
      ) : null}

      {showSearchAndList ? (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by repo name or description"
              className={cn(
                "h-10 w-full rounded-md border border-border-strong bg-surface px-3 pl-9",
                "text-body-md outline-none placeholder:text-fg-muted",
                "focus:border-primary",
              )}
            />
          </div>

          <div className="min-h-[280px] space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-md border border-border bg-surface-elevated px-3 py-6 text-center text-body-sm text-fg-muted">
                {query
                  ? "No repos match your search."
                  : "No admin/maintain-permission repos in your installed accounts."}
              </div>
            ) : null}

            {grouped.map((group, idx) => (
              <InstallationGroup
                key={
                  group.installation?.installationId ??
                  `unknown-${idx}-${group.repos[0]?.id ?? idx}`
                }
                installation={group.installation}
                repos={group.repos}
                appSlug={appSlug}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}

            {installNewUrl ? (
              <a
                href={installNewUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong",
                  "bg-surface-elevated px-3 py-3 text-body-sm text-fg-secondary",
                  "transition-colors hover:bg-surface hover:text-fg",
                )}
              >
                <Plus className="size-4" aria-hidden />
                Add another account or org
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

interface InstallationGroupProps {
  installation: GithubInstallationSummary | null;
  repos: GithubRepo[];
  appSlug: string | undefined;
  selectedId: string | null;
  onSelect: (repo: GithubRepo) => void;
}

function InstallationGroup({
  installation,
  repos,
  appSlug,
  selectedId,
  onSelect,
}: InstallationGroupProps) {
  const accountLogin =
    installation?.accountLogin ?? repos[0]?.accountLogin ?? "Unknown";
  const accountAvatarUrl =
    installation?.accountAvatarUrl ?? repos[0]?.accountAvatarUrl ?? null;
  const accountType =
    installation?.accountType ?? repos[0]?.accountType ?? "User";
  const installationId =
    installation?.installationId ?? repos[0]?.installationId ?? null;
  const manageUrl =
    installationId && accountLogin
      ? accountType === "Organization"
        ? `https://github.com/organizations/${accountLogin}/settings/installations/${installationId}`
        : `https://github.com/settings/installations/${installationId}`
      : appSlug
        ? `https://github.com/apps/${appSlug}/installations/new`
        : null;

  return (
    <section
      aria-label={`Repositories from ${accountLogin}`}
      className="overflow-hidden rounded-md border border-border"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-elevated px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {accountAvatarUrl ? (
            <Image
              src={accountAvatarUrl}
              alt=""
              width={24}
              height={24}
              unoptimized
              className="size-6 shrink-0 rounded-full bg-surface"
            />
          ) : (
            <Github className="size-5 shrink-0 text-fg-muted" aria-hidden />
          )}
          <span className="truncate text-label-md text-fg">{accountLogin}</span>
          <span className="text-caption text-fg-muted">
            {accountType === "Organization" ? "Org" : "User"}
          </span>
        </div>
        {manageUrl ? (
          <a
            href={manageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-label-sm text-fg-secondary transition-colors hover:text-fg"
          >
            Manage installation
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </header>
      <ul className="divide-y divide-border">
        {repos.map((repo) => {
          const isSelected = selectedId === repo.id;
          const isDisabled = repo.alreadyLaunched;
          return (
            <li key={repo.id}>
              <button
                type="button"
                onClick={() => !isDisabled && onSelect(repo)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  !isDisabled && "hover:bg-surface-elevated",
                  isSelected && "bg-surface-elevated",
                  isDisabled && "opacity-50",
                )}
              >
                <Image
                  src={repo.ownerAvatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 shrink-0 rounded-full bg-surface"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-body-md text-fg">
                      {repo.fullName}
                    </span>
                    {repo.alreadyLaunched ? (
                      <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-label-sm text-warning">
                        Already launched
                      </span>
                    ) : null}
                    {!repo.permissionAdmin && repo.permissionMaintain ? (
                      <span className="inline-flex items-center rounded-full border border-border-strong bg-surface px-2 py-0.5 text-label-sm text-fg-secondary">
                        Maintain
                      </span>
                    ) : null}
                  </div>
                  {repo.description ? (
                    <p className="mt-0.5 line-clamp-2 text-body-sm text-fg-secondary">
                      {repo.description}
                    </p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-4 text-caption text-fg-muted">
                    {repo.language ? <span>{repo.language}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3" />
                      <span className="text-mono-sm">
                        {repo.stargazersCount}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitFork className="size-3" />
                      <span className="text-mono-sm">{repo.forksCount}</span>
                    </span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyInstallationsCard({
  installNewUrl,
}: {
  installNewUrl: string | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-md border border-border",
        "bg-surface-elevated px-6 py-10 text-center",
      )}
    >
      <Github className="size-8 text-fg-muted" aria-hidden />
      <div className="space-y-1">
        <p className="text-headline-sm">Install the GitBags GitHub App</p>
        <p className="mx-auto max-w-md text-body-sm text-fg-secondary">
          GitBags needs to be installed on the account or org that owns the
          repo before it can launch a token. Click below to install on your
          personal account or any org you administer.
        </p>
      </div>
      {installNewUrl ? (
        <a
          href={installNewUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2",
            "text-label-md text-fg transition-colors hover:opacity-90",
          )}
        >
          Install GitBags on GitHub
          <ExternalLink className="size-4" aria-hidden />
        </a>
      ) : (
        <p className="text-body-sm text-fg-muted">
          GITHUB_APP_SLUG is not configured — ask the operator to set it.
        </p>
      )}
    </div>
  );
}

function friendlyError(
  status: number,
  code: string | undefined,
  message: string | undefined,
): string {
  if (status === 401) {
    return (
      message ?? "You're not signed in with GitHub. Sign in to list your repos."
    );
  }
  if (status === 503) {
    return (
      message ??
      "GitHub OAuth or the GitBags App isn't configured on this environment yet."
    );
  }
  if (status === 429) {
    return "You're loading repos too fast. Wait a minute and try again.";
  }
  if (code === "github_error") {
    return message ?? "GitHub returned an error. Check your token scopes.";
  }
  return message ?? `GitHub list-repos failed (HTTP ${status}).`;
}
