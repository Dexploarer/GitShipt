import { beforeEach, describe, expect, test } from "vitest";
import { createUiStore } from "@repo/ui";

describe("ui store", () => {
  const store = createUiStore();

  beforeEach(() => {
    store.setState({
      sidebar: {
        collapsed: false,
        mobileOpen: false,
      },
    });
  });

  test("tracks persisted desktop sidebar collapse state", () => {
    store.getState().setSidebarCollapsed(true);
    expect(store.getState().sidebar.collapsed).toBe(true);

    store.getState().toggleSidebarCollapsed();
    expect(store.getState().sidebar.collapsed).toBe(false);
  });

  test("resets transient mobile drawer state without changing preferences", () => {
    store.getState().setSidebarCollapsed(true);
    store.getState().setSidebarMobileOpen(true);

    store.getState().resetTransientUi();

    expect(store.getState().sidebar.collapsed).toBe(true);
    expect(store.getState().sidebar.mobileOpen).toBe(false);
  });
});
