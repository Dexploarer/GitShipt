"use client";

import * as React from "react";
import type { SessionUserChrome } from "@/lib/auth/session";

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
  return (
    <SessionChromeContext.Provider value={user}>
      {children}
    </SessionChromeContext.Provider>
  );
}

export function useSessionChrome(): SessionUserChrome | null {
  return React.useContext(SessionChromeContext);
}
