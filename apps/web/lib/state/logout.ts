"use client";

import { clearLogoutStorage, useAuthStore } from "./auth-store";
import { resetLaunchWizardStore } from "./launch-wizard-store";

/**
 * Clears client-owned state that must not survive logout. Server-owned data is
 * still invalidated by the auth route and router.refresh().
 */
export function resetClientStateForLogout(): void {
  useAuthStore.getState().clearAuth();
  resetLaunchWizardStore();
  clearLogoutStorage();
}
