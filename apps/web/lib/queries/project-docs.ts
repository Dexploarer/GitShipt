import "server-only";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";
import { cacheLife, cacheTag } from "next/cache";

import { cacheTags } from "@/lib/cache";
import { z } from "zod";

export interface ProjectDocsValue {
  markdown: string;
  published: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function projectDocsKey(projectId: string): string {
  return `project_docs.${projectId}`;
}

const ProjectDocsConfigSchema = z.object({
  markdown: z.string().default(""),
  published: z.boolean().default(false),
  updatedBy: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

async function getProjectDocsUncached(
  projectId: string,
): Promise<ProjectDocsValue> {
  const [row] = await dbHttp
    .select({
      value: platformConfig.value,
      updatedAt: platformConfig.updatedAt,
    })
    .from(platformConfig)
    .where(eq(platformConfig.key, projectDocsKey(projectId)))
    .limit(1);

  const value = row?.value ?? {};
  const parsed = ProjectDocsConfigSchema.catch({
    markdown: "",
    published: false,
    updatedBy: null,
    updatedAt: null,
  }).parse(value);
  return {
    markdown: parsed.markdown,
    published: parsed.published,
    updatedBy: parsed.updatedBy ?? null,
    updatedAt:
      parsed.updatedAt ??
      row?.updatedAt?.toISOString() ??
      null,
  };
}

export async function getProjectDocs(
  projectId: string,
): Promise<ProjectDocsValue> {
  "use cache";
  cacheLife("auth");
  cacheTag(cacheTags.dashboard);
  cacheTag(cacheTags.dashboardProject(projectId));
  cacheTag(cacheTags.project(projectId));
  cacheTag(cacheTags.platformConfig);
  return await getProjectDocsUncached(projectId);
}
