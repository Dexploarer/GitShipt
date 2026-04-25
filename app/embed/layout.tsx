/**
 * Embed-route layout. Strips the global app shell so iframes only render
 * the widget. The root layout still applies (font + ThemeProvider + body
 * styles); we just override anything that would break iframe sizing.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0">
      {/* Inline style block lets us override the body bg per-route without
          polluting globals.css with embed-specific selectors. The host
          iframe's parent page still controls iframe-level styling. */}
      <style>{`html, body { background: transparent !important; min-height: 0 !important; height: auto !important; }`}</style>
      {children}
    </div>
  );
}
