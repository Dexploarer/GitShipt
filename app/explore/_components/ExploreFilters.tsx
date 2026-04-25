"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusKey = "all" | "live" | "paused";
type SortKey = "trending" | "lifetime" | "contributors" | "newest";

const STATUS_OPTIONS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "trending", label: "Trending (24h fees)" },
  { key: "lifetime", label: "Top earners (lifetime SOL)" },
  { key: "contributors", label: "Most contributors" },
  { key: "newest", label: "Newest" },
];

/**
 * URL-driven filter bar for /explore. Reads + writes query params (`status`,
 * `sort`, `q`) so filters are deep-linkable + back/forward-able. The page
 * re-renders server-side every time params change — we just navigate.
 *
 * Search input is debounced 300ms so we don't fire a navigation per keystroke.
 */
export function ExploreFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const status = (params.get("status") as StatusKey | null) ?? "all";
  const sort = (params.get("sort") as SortKey | null) ?? "trending";
  const q = params.get("q") ?? "";

  // Local search state (debounced) — keeps the input responsive while
  // we hold off pushing the URL until the user pauses typing.
  const [searchValue, setSearchValue] = useState(q);
  useEffect(() => {
    setSearchValue(q);
  }, [q]);

  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
      });
    },
    [params, router],
  );

  useEffect(() => {
    if (searchValue === q) return;
    const t = setTimeout(() => {
      pushParams((p) => {
        if (searchValue) p.set("q", searchValue);
        else p.delete("q");
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchValue, q, pushParams]);

  const [sortOpen, setSortOpen] = useState(false);

  return (
    <div className="sticky top-16 z-30 -mx-margin border-b border-border bg-bg/85 px-margin py-3 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-content flex-wrap items-center gap-3">
        {/* Status chips */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {STATUS_OPTIONS.map(({ key, label }) => {
            const on = status === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  pushParams((p) => {
                    if (key === "all") p.delete("status");
                    else p.set("status", key);
                  })
                }
                className={cn(
                  "rounded px-3 py-1.5 text-label-sm transition-colors",
                  on
                    ? "bg-surface-elevated text-fg shadow-inset-light"
                    : "text-fg-secondary hover:text-fg",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 size-4 text-fg-muted" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search by repo or name…"
            className="h-9 w-full rounded-md border border-border-strong bg-surface px-9 text-body-md text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              aria-label="Clear search"
              className="absolute right-2 inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-surface-elevated hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>

        {/* Sort dropdown */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            onBlur={() => setTimeout(() => setSortOpen(false), 120)}
            aria-expanded={sortOpen}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-label-md text-fg transition-colors hover:bg-surface-elevated"
          >
            <span className="text-fg-muted">Sort:</span>
            <span>
              {SORT_OPTIONS.find((o) => o.key === sort)?.label ??
                SORT_OPTIONS[0]?.label}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-fg-muted transition-transform",
                sortOpen && "rotate-180",
              )}
            />
          </button>
          {sortOpen ? (
            <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-border-strong bg-surface-overlay p-1 shadow-popover">
              {SORT_OPTIONS.map(({ key, label }) => {
                const on = sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSortOpen(false);
                      pushParams((p) => {
                        if (key === "trending") p.delete("sort");
                        else p.set("sort", key);
                      });
                    }}
                    className={cn(
                      "block w-full rounded-md px-3 py-2 text-left text-body-sm transition-colors",
                      on
                        ? "bg-surface-elevated text-fg"
                        : "text-fg-secondary hover:bg-surface-elevated hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
