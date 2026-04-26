import "server-only";
import { cookies } from "next/headers";

const SIDEBAR_COLLAPSED_COOKIE = "gitbags_sidebar_collapsed";

export async function getDefaultSidebarCollapsed(): Promise<boolean> {
  const store = await cookies();
  return store.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
}
