import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { hasCredentials } from "@/lib/env";
import { cacheTags } from "@/lib/cache";

export interface LaunchWizardConfig {
  isStubMode: boolean;
}

async function getLaunchWizardConfigUncached(): Promise<LaunchWizardConfig> {
  try {
    return { isStubMode: !hasCredentials.bags() };
  } catch {
    return { isStubMode: true };
  }
}

export async function getLaunchWizardConfig(): Promise<LaunchWizardConfig> {
  "use cache";
  cacheLife("browse");
  cacheTag(cacheTags.launch);
  return await getLaunchWizardConfigUncached();
}
