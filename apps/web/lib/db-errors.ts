import "server-only";

/**
 * Detect a `(gh_owner, gh_repo)` UNIQUE violation on the projects table.
 *
 * Drizzle wraps the underlying pg error in `cause`, so the constraint name
 * lives on `e.cause.constraint` (or in the cause's message) — not on the
 * top-level `e.message`. Walk the cause chain to find it.
 */
export function isProjectsGhRepoUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (typeof cur !== "object" || cur === null) break;
    const rec = cur as {
      constraint?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (rec.constraint === "projects_gh_repo_uq") return true;
    if (
      typeof rec.message === "string" &&
      /projects_gh_repo_uq/i.test(rec.message)
    ) {
      return true;
    }
    cur = rec.cause;
  }
  return false;
}
