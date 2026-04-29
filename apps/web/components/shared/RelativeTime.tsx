"use client";

import { useEffect, useState } from "react";
import { cn, formatRelativeTime } from "@repo/lib";

interface RelativeTimeProps {
  date: Date | string | number;
  /** Re-render interval in seconds. Default 30s — sub-minute granularity is
   *  enough for "synced 4m ago" labels. */
  intervalSec?: number;
  className?: string;
}

/**
 * Auto-updating relative-time label. Server renders the string at request
 * time; the client island re-renders every `intervalSec` seconds so the
 * "2m ago" / "1h ago" label stays accurate without the user reloading.
 *
 * Mismatch between SSR and first client render is intentional (clocks differ
 * by a few seconds) — `suppressHydrationWarning` avoids the React warning.
 */
export function RelativeTime({
  date,
  intervalSec = 30,
  className,
}: RelativeTimeProps) {
  // We don't read the tick — it just forces a re-render so formatRelativeTime
  // computes against a fresh Date.now().
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalSec * 1000);
    return () => clearInterval(id);
  }, [intervalSec]);

  const dateObj = date instanceof Date ? date : new Date(date);
  const valid = Number.isFinite(dateObj.getTime());
  const iso = valid ? dateObj.toISOString() : "";

  return (
    <time
      dateTime={iso}
      title={valid ? dateObj.toLocaleString() : "unknown"}
      className={cn(className)}
      suppressHydrationWarning
    >
      {formatRelativeTime(dateObj)}
    </time>
  );
}
