import { z } from "zod";

/**
 * Cursor pagination helpers.
 *
 * Cursor format is `<isoTimestamp>:<id>` so a list ordered by
 * `(created_at DESC, id DESC)` can resume past any row deterministically.
 * We never expose internal offsets; callers send back the opaque cursor
 * string they received from the previous page's `nextCursor`.
 */

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 100;

export const PaginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
  cursor: z
    .string()
    .max(120)
    .regex(
      /^[0-9TZ:.\-+]+:[A-Za-z0-9_-]{1,40}$/,
      "Cursor must be <isoTimestamp>:<id>",
    )
    .optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export interface CursorParts {
  createdAt: Date;
  id: string;
}

export function decodeCursor(cursor: string | undefined): CursorParts | null {
  if (!cursor) return null;
  const sep = cursor.lastIndexOf(":");
  if (sep <= 0 || sep >= cursor.length - 1) return null;
  const tsRaw = cursor.slice(0, sep);
  const id = cursor.slice(sep + 1);
  const ts = new Date(tsRaw);
  if (Number.isNaN(ts.getTime())) return null;
  return { createdAt: ts, id };
}

export function encodeCursor(parts: CursorParts): string {
  return `${parts.createdAt.toISOString()}:${parts.id}`;
}

/**
 * Build a `{ rows, nextCursor }` page from an over-fetched query result.
 * Caller fetches `limit + 1`; if the extra row is present, the page has
 * a successor and we return its cursor. Otherwise nextCursor is null.
 */
export function buildPage<
  T extends { id: string; createdAt: Date | string | null },
>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null };
  const trimmed = rows.slice(0, limit);
  const last = trimmed[trimmed.length - 1]!;
  const ts =
    last.createdAt instanceof Date
      ? last.createdAt
      : last.createdAt
        ? new Date(last.createdAt)
        : new Date();
  return {
    rows: trimmed,
    nextCursor: encodeCursor({ createdAt: ts, id: last.id }),
  };
}
