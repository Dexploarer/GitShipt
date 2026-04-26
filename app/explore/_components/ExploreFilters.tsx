"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type StatusKey = "all" | "live" | "paused";
type SortKey = "trending" | "lifetime" | "contributors" | "newest";

const STATUS_OPTIONS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "trending", label: "Trending · 24h fees" },
  { key: "lifetime", label: "Top earners · lifetime" },
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
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 glass surface-highlight px-3 py-3 shadow-card-elevated md:flex-row md:items-center md:gap-3">
      {/* Search */}
      <Input
        variant="ghost"
        size="default"
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder="Search by repo, name, or owner…"
        leadingIcon={<Search className="size-4" />}
        clearable
        onClear={() => setSearchValue("")}
        wrapperClassName="md:max-w-md md:flex-1"
        aria-label="Search projects"
      />

      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {/* Status segmented chips */}
        <div
          role="tablist"
          aria-label="Status filter"
          className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-bg/40 p-0.5"
        >
          {STATUS_OPTIONS.map(({ key, label }) => {
            const on = status === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
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

        {/* Sort dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            onBlur={() => setTimeout(() => setSortOpen(false), 120)}
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-bg/40 px-3 text-label-md text-fg",
              "transition-colors hover:bg-surface-elevated/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            )}
          >
            <span className="text-fg-muted">Sort</span>
            <span className="text-mono-sm text-fg-secondary">·</span>
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
            <div
              role="listbox"
              className="absolute right-0 z-40 mt-1 w-64 rounded-lg border border-border/60 glass surface-highlight p-1 shadow-popover"
            >
              {SORT_OPTIONS.map(({ key, label }) => {
                const on = sort === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={on}
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
                        ? "bg-surface-elevated text-fg shadow-inset-light"
                        : "text-fg-secondary hover:bg-surface-elevated/60 hover:text-fg",
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
