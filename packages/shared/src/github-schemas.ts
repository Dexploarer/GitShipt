import { z } from "zod";

export const PublicRepoContributorSchema = z.object({
  ghUserId: z.string().min(1),
  ghUsername: z.string().min(1),
  avatarUrl: z.string().url(),
  contributions: z.number().int().min(0),
});
export type PublicRepoContributor = z.infer<typeof PublicRepoContributorSchema>;

export const PublicRepoContributorsSchema = z.array(PublicRepoContributorSchema);

export const GitHubUserProfileSchema = z.object({
  login: z.string().min(1),
  id: z.number().int(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  blog: z.string().nullable(),
  email: z.string().nullable(),
  twitterUsername: z.string().nullable(),
  avatarUrl: z.string().url(),
  htmlUrl: z.string().url(),
  publicRepos: z.number().int().min(0),
  followers: z.number().int().min(0),
  following: z.number().int().min(0),
  createdAt: z.string().min(1),
});
export type GitHubUserProfile = z.infer<typeof GitHubUserProfileSchema>;

export const GitHubUserProfileCacheSchema = z.union([
  GitHubUserProfileSchema,
  z.object({ __null: z.literal(true) }),
]);

export const GitHubRepoMetaSchema = z.object({
  language: z.string().nullable(),
  stars: z.number().int().min(0),
  forks: z.number().int().min(0),
});
export type GitHubRepoMeta = z.infer<typeof GitHubRepoMetaSchema>;
