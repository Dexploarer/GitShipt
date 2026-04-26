import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware class joiner. Used by every component for conditional classes.
 * Handles deduping conflicting utilities (e.g. `bg-surface bg-surface-elevated`
 * → `bg-surface-elevated`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
