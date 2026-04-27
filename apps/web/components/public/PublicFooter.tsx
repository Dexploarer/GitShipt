import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { clusterLabel } from "@/lib/solana/explorer";

/**
 * Minimal footer for public pages. Stays out of the way; it carries the
 * "powered by" line + the canonical socials. Matches the project page
 * footer pattern so the brand reads consistently.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border px-margin py-6">
      <div className="mx-auto flex w-full max-w-content items-center justify-between gap-4 text-caption text-fg-muted">
        <span>Powered by BAGS.fm</span>
        <div className="flex items-center gap-1">
          <SocialLink
            href="https://github.com/bagsdotfm"
            label="GitBags on GitHub"
          >
            <Github className="size-4" />
          </SocialLink>
          <SocialLink href="https://x.com/bagsdotfm" label="Bags on X">
            <Twitter className="size-4" />
          </SocialLink>
        </div>
        <span>
          © {year} GitBags <span aria-hidden>·</span> {clusterLabel()}
        </span>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-elevated hover:text-fg"
    >
      {children}
    </Link>
  );
}
