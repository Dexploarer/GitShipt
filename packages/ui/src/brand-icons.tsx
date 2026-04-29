import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

/**
 * Brand icons (GitHub, X/Twitter) — lucide-react dropped brand logos in v1, so
 * we ship our own SVG components with a `LucideIcon`-compatible signature
 * (forwardRef + LucideProps) so they slot into anywhere `LucideIcon` is
 * accepted as a prop type.
 */

const baseProps = (size: number | string = 24) =>
  ({
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true",
  }) as const;

export const Github = forwardRef<SVGSVGElement, LucideProps>(function Github(
  {
    size = 24,
    strokeWidth: _sw,
    absoluteStrokeWidth: _asw,
    color: _color,
    ...props
  },
  ref,
) {
  return (
    <svg ref={ref} {...baseProps(size)} {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
});

export const Twitter = forwardRef<SVGSVGElement, LucideProps>(function Twitter(
  {
    size = 24,
    strokeWidth: _sw,
    absoluteStrokeWidth: _asw,
    color: _color,
    ...props
  },
  ref,
) {
  return (
    <svg ref={ref} {...baseProps(size)} {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
    </svg>
  );
});
