import { customAlphabet } from "nanoid";

/**
 * URL-safe, sortable-ish (timestamp-prefix not enforced; we rely on
 * createdAt for ordering) ID generator. 21 chars of [0-9a-zA-Z] gives ~10^37
 * combinations — collision-free at any scale we'll ever hit.
 */
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 21);

export function createId(prefix?: string): string {
  return prefix ? `${prefix}_${nano()}` : nano();
}
