"use client";

import { create } from "zustand";

export type AuthenticatedRouteSurface =
  | "public"
  | "owner-project"
  | "public-project"
  | "admin";

interface AuthenticatedRouteState {
  pathname: string;
  surface: AuthenticatedRouteSurface;
  activeKey: string | null;
  setRouteChrome: (next: {
    pathname: string;
    surface: AuthenticatedRouteSurface;
    activeKey: string | null;
  }) => void;
  resetRouteChrome: () => void;
}

export const useAuthenticatedRouteStore = create<AuthenticatedRouteState>(
  (set) => ({
    pathname: "/",
    surface: "public",
    activeKey: null,
    setRouteChrome: (next) => set(next),
    resetRouteChrome: () =>
      set({ pathname: "/", surface: "public", activeKey: null }),
  }),
);
