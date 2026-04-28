import "server-only";
import { hasCredentials } from "@/lib/env";
import { CACHE_SECONDS, cacheTags, getCachedValue } from "@/lib/cache";

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
  return getCachedValue(
    () => getLaunchWizardConfigUncached(),
    ["gitbags:launch:wizard-config:v1"],
    {
      tags: [cacheTags.launch],
      revalidate: CACHE_SECONDS.browse,
    },
  );
}
