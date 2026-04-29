"use client";

import * as React from "react";
import type { SparklinePoint } from "@repo/lib";

/**
 * 30-day pool sparkline. Pure inline SVG — replaces a recharts AreaChart
 * (~150KB gz) with under 100 lines of math. The visual contract is the same:
 * a `chart-1`-stroked monotone area with a fading-to-transparent fill,
 * no axes, hover tooltip showing date + SOL value. BigInts are pre-converted
 * to numbers by the parent via `lamportsSeriesToSol` so they cross the
 * client boundary cleanly.
 *
 * Why not recharts:
 *   - Single sparkline on the project page didn't justify the bundle.
 *   - Recharts' `ResponsiveContainer` runs a ResizeObserver on every render.
 *   - SSR-friendly: an SVG with explicit viewBox renders without JS.
 */
export function PoolSparkline({ data }: { data: SparklinePoint[] }) {
  const [hover, setHover] = React.useState<{
    point: SparklinePoint;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(320);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setWidth(Math.max(1, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const HEIGHT = 80;
  const PAD_TOP = 6;
  const PAD_BOTTOM = 4;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  if (data.length < 2) {
    return (
      <div ref={containerRef} className="h-20 min-w-0 w-full" aria-hidden />
    );
  }

  const values = data.map((d) => d.sol);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const pts = data.map((d, i) => {
    const x = i * stepX;
    const y = PAD_TOP + innerH * (1 - (d.sol - min) / span);
    return { x, y, raw: d };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const firstPt = pts[0]!;
  const lastPt = pts[pts.length - 1]!;
  const areaPath =
    `M ${firstPt.x.toFixed(2)} ${HEIGHT}` +
    ` L ${linePath.slice(2)}` +
    ` L ${lastPt.x.toFixed(2)} ${HEIGHT} Z`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = e.clientX - rect.left;
    const idx = Math.max(
      0,
      Math.min(pts.length - 1, Math.round(x / stepX)),
    );
    const p = pts[idx];
    if (p) setHover({ point: p.raw, x: p.x, y: p.y });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-20 min-w-0 w-full"
      role="img"
      aria-label={`30-day pool trend, latest ${lastPt.raw.sol.toFixed(4)} SOL`}
    >
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        preserveAspectRatio="none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="poolFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#poolFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover ? (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="var(--border-strong)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="3"
              fill="var(--chart-1)"
            />
          </>
        ) : null}
      </svg>
      {hover ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-border-strong bg-surface-overlay px-3 py-2 shadow-popover"
          style={{
            left: Math.min(width - 4, Math.max(4, hover.x)),
            top: Math.max(0, hover.y - 4),
          }}
        >
          <div className="text-caption text-fg-muted">{hover.point.date}</div>
          <div className="mt-0.5 text-mono-sm text-fg">
            {hover.point.sol.toFixed(4)} SOL
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { SparklinePoint as PoolSparklinePoint } from "@repo/lib";
