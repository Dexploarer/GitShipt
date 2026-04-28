/**
 * Single docs section with an anchor target. The page TOC links to `#${id}`
 * and the heading itself is a link so users can grab a permalink.
 *
 * Server component — no client state.
 */
export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-4">
      <h2 className="group flex items-baseline gap-2 text-headline-md text-fg">
        <a
          href={`#${id}`}
          className="transition-colors hover:text-primary"
          aria-label={`Link to ${title}`}
        >
          {title}
        </a>
      </h2>
      <div className="flex flex-col gap-4 text-body-md text-fg-secondary">
        {children}
      </div>
    </section>
  );
}
