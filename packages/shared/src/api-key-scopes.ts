import { z } from "zod";

export const ProjectApiKeyScopeSchema = z.enum([
  "read:project",
  "read:leaderboard",
  "read:payouts",
  "read:token",
  "write:webhook",
]);

export type ProjectApiKeyScope = z.infer<typeof ProjectApiKeyScopeSchema>;

export const PROJECT_API_KEY_SCOPE_LABELS: Record<ProjectApiKeyScope, string> =
  {
    "read:project": "Project",
    "read:leaderboard": "Leaderboard",
    "read:payouts": "Payouts",
    "read:token": "Token",
    "write:webhook": "Webhook",
  };

export const PROJECT_API_KEY_SCOPE_DESCRIPTIONS: Record<
  ProjectApiKeyScope,
  string
> = {
  "read:project": "Read public project metadata.",
  "read:leaderboard": "Read generated leaderboard rows.",
  "read:payouts": "Read payout and claim summaries.",
  "read:token": "Read token and Bags launch metadata.",
  "write:webhook": "Write webhook delivery state.",
};

export const PROJECT_API_KEY_SCOPES = ProjectApiKeyScopeSchema.options;

export const ProjectApiKeyScopesSchema = z
  .array(ProjectApiKeyScopeSchema)
  .min(1)
  .max(PROJECT_API_KEY_SCOPES.length)
  .superRefine((scopes, ctx) => {
    if (new Set(scopes).size !== scopes.length) {
      ctx.addIssue({
        code: "custom",
        message: "API key scopes must be unique.",
      });
    }
  });
