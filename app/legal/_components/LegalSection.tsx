import type { ReactNode } from "react";

/**
 * LegalSection — DRY chrome for numbered legal sections used by
 * /legal/terms and /legal/privacy. Server component, design-token
 * typography, slugified anchor IDs.
 */
export interface LegalSectionProps {
  index: number;
  title: string;
  children: ReactNode;
}

export function LegalSection({ index, title, children }: LegalSectionProps) {
  const slug = slugify(title);
  return (
    <section
      id={slug}
      className="flex scroll-mt-24 flex-col gap-3"
      aria-labelledby={`${slug}-heading`}
    >
      <h2
        id={`${slug}-heading`}
        className="flex items-baseline gap-3 text-headline-sm tracking-tight text-fg"
      >
        <span className="text-mono-sm text-fg-muted tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <span>{title}</span>
      </h2>
      <div className="flex flex-col gap-3 text-body-md text-fg-secondary">
        {children}
      </div>
    </section>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
