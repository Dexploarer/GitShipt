import "server-only";
import { eq } from "drizzle-orm";
import { dbHttp } from "@/db";
import { platformConfig } from "@/db/schema";

export interface ProjectDocsValue {
  markdown: string;
  published: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function projectDocsKey(projectId: string): string {
  return `project_docs.${projectId}`;
}

export async function getProjectDocs(
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
  return {
    markdown: typeof value.markdown === "string" ? value.markdown : "",
    published: value.published === true,
    updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : null,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : (row?.updatedAt?.toISOString() ?? null),
  };
}
