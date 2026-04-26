/**
 * SkipLink — accessible "skip to main content" anchor.
 *
 * Visually hidden until it receives keyboard focus (Tab from address bar /
 * top of page). When focus-visible, it surfaces as a pill in the top-left so
 * keyboard and screen-reader users can jump past the sidebar / header into
 * the page's primary content region.
 *
 * Targets the `#main-content` wrapper rendered by the root layout.
 *
 * Tokens-only (no raw hex). Uses the `bg-primary / text-bg` pairing for the
 * highest-contrast affordance once focused.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:inline-flex focus-visible:items-center focus-visible:gap-2 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-3 focus-visible:py-2 focus-visible:text-label-md focus-visible:text-bg focus-visible:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      Skip to content
    </a>
  );
}
