"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side better-auth wrapper. Imported by signin/wallet pages and
 * any client-side session check (rare — most checks happen on the server).
 *
 * baseURL falls back to same-origin so the client doesn't need to know
 * about NEXT_PUBLIC_APP_URL at build time.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      : window.location.origin,
});
