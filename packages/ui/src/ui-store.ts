"use client";

import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
}

export interface UiState {
  sidebar: SidebarState;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  closeSidebarMobile: () => void;
  toggleSidebarMobile: () => void;
  resetTransientUi: () => void;
}

export type UiStore = StoreApi<UiState>;

export function createUiStore(initial?: Partial<SidebarState>): UiStore {
  const initialSidebar: SidebarState = {
    collapsed: initial?.collapsed ?? false,
    mobileOpen: initial?.mobileOpen ?? false,
  };

  return createStore<UiState>((set) => ({
    sidebar: initialSidebar,
    setSidebarCollapsed: (collapsed) =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          collapsed,
        },
      })),
    toggleSidebarCollapsed: () =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          collapsed: !state.sidebar.collapsed,
        },
      })),
    setSidebarMobileOpen: (open) =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          mobileOpen: open,
        },
      })),
    closeSidebarMobile: () =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          mobileOpen: false,
        },
      })),
    toggleSidebarMobile: () =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          mobileOpen: !state.sidebar.mobileOpen,
        },
      })),
    resetTransientUi: () =>
      set((state) => ({
        sidebar: {
          ...state.sidebar,
          mobileOpen: false,
        },
      })),
  }));
}

export function useUiStoreValue<T>(
  store: UiStore,
  selector: (state: UiState) => T,
): T {
  return useStore(store, selector);
}
