import { PublicNav, type PublicNavActive } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

/**
 * Outer wrapper used by every public discovery surface. Pairs a sticky
 * top nav with a centered max-width main column and a minimal footer.
 * Server-component safe; the only client island is the nav itself.
 */
export function PublicShell({
  active,
  children,
}: {
  active?: PublicNavActive;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <PublicNav active={active} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-content flex-1 px-margin py-12 outline-none"
      >
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
