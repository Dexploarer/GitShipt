"use client";

import * as React from "react";
import type { SessionUserChrome } from "@/lib/auth/session";
import { useAuthStore } from "@/lib/state/auth-store";

const SessionChromeContext = React.createContext<SessionUserChrome | null>(
  null,
);

export function SessionChromeProvider({
  user,
  children,
}: {
  user: SessionUserChrome | null;
  children: React.ReactNode;
}) {
  const storeUser = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setAuth = useAuthStore((state) => state.setAuth);

  React.useEffect(() => {
    setAuth(user);
  }, [setAuth, user]);

  const value = React.useMemo(() => {
    if (status === "signed-out") return null;
    return storeUser ?? user;
  }, [status, storeUser, user]);

  return (
    <SessionChromeContext.Provider value={value}>
      {children}
    </SessionChromeContext.Provider>
  );
}

export function useSessionChrome(): SessionUserChrome | null {
  return React.useContext(SessionChromeContext);
}
