"use client";

import { create } from "zustand";
import type { SessionUserChrome } from "@/lib/auth/session";

export type AuthStoreUser = SessionUserChrome;

type AuthStatus = "unknown" | "authenticated" | "signed-out";

interface AuthState {
  /**
   * Client-side mirror of the server session chrome. This is not an authority
   * for access control; routes and mutations still revalidate the cookie-backed
   * better-auth session on the server.
   */
  user: AuthStoreUser | null;
  status: AuthStatus;
  setAuth: (user: AuthStoreUser | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "unknown",
  setAuth: (user) =>
    set({
      user,
      status: user ? "authenticated" : "signed-out",
    }),
  clearAuth: () =>
    set({
      user: null,
      status: "signed-out",
    }),
}));

export function clearLogoutStorage(): void {
  if (typeof window === "undefined") return;

  // Keep user preferences such as theme and sidebar collapse. Only clear
  // auth-bound app caches if they are introduced later.
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (
        key.startsWith("gitbags:auth:") ||
        key.startsWith("gitbags:session:") ||
        key.startsWith("gitbags:user:")
      ) {
        storage.removeItem(key);
      }
    }
  }
}
