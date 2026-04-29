import "server-only";
import { headers } from "next/headers";
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { dbHttp } from "@/db";
import { accounts } from "@/db/schema";
import { check } from "@/lib/rate-limit";
import { hasCredentials } from "@/lib/env";
import { redis } from "@/lib/redis";
import { privateNoStoreJson } from "@/lib/no-store-response";
import { RepoEnrichmentSchema, type RepoEnrichment } from "@repo/shared";

export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 5 * 60;
const README_EXCERPT_MAX = 600;

/**
 * Lazy enrichment for the launch wizard's token-metadata step.
 *
 * The list endpoint already returns the cheap fields baked into
 * `GET /user/repos`. This route makes the two extra calls that aren't worth
 * paying for every list render — owner profile + README — and computes the
 * GitHub-generated OG banner URL. Cached 5min in Redis per owner/repo.
 *
 * Returns public-only data: Twitter handle, blog, README excerpt, OG image.
 * No permission gate beyond an authed session — these are all already public
 * on github.com for any repo this endpoint hits.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
): Promise<Response> {
  if (!hasCredentials.github()) {
    return privateNoStoreJson(
      { error: "auth_unavailable", message: "GitHub OAuth not configured." },
      { status: 503 },
    );
  }
  if (!hasCredentials.db()) {
    return privateNoStoreJson(
      { error: "db_unavailable", message: "DB not configured." },
      { status: 503 },
    );
  }

  const { owner, repo } = await params;
  if (!isSafeSegment(owner) || !isSafeSegment(repo)) {
    return privateNoStoreJson(
      { error: "bad_request", message: "Invalid owner/repo." },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return privateNoStoreJson(
      { error: "unauthorized", message: "Sign in to enrich repo metadata." },
      { status: 401 },
    );
  }
  const userId = session.user.id;

  const limit = await check("default", `gh-enrich:${userId ?? ip}`);
  if (!limit.success) {
    return privateNoStoreJson({ error: "rate_limited" }, { status: 429 });
  }

  const r = redis();
  const cacheKey = `gitshipt:gh:enrich:${owner}/${repo}`;
  if (r) {
    const cached = await r.get(cacheKey);
    if (cached) {
      try {
        const parsed = RepoEnrichmentSchema.parse(JSON.parse(cached));
        return privateNoStoreJson(parsed, { headers: { "x-cache": "HIT" } });
      } catch {
        // fall through and re-fetch
      }
    }
  }

  const [account] = await dbHttp
    .select({ accessToken: accounts.accessToken })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  if (!account?.accessToken) {
    return privateNoStoreJson(
      {
        error: "missing_github_token",
        message: "No GitHub OAuth token on file.",
      },
      { status: 401 },
    );
  }

  const octokit = new Octokit({ auth: account.accessToken });

  // Parallel: owner profile + README. Either can fail independently — the
  // user has a valid token at this point, so 404s mean the resource is
  // genuinely absent (private profile fields, no README), not unauthorized.
  const [profileResult, readmeResult] = await Promise.allSettled([
    octokit.request("GET /users/{username}", { username: owner }),
    octokit.request("GET /repos/{owner}/{repo}/readme", { owner, repo }),
  ]);

  let ownerTwitterUsername: string | null = null;
  let ownerBlog: string | null = null;
  if (profileResult.status === "fulfilled") {
    const data = profileResult.value.data as {
      twitter_username?: string | null;
      blog?: string | null;
    };
    ownerTwitterUsername = nullIfEmpty(data.twitter_username);
    ownerBlog = nullIfEmpty(data.blog);
  }

  let readmeExcerpt: string | null = null;
  if (readmeResult.status === "fulfilled") {
    const data = readmeResult.value.data as {
      content?: string;
      encoding?: string;
    };
    if (data.content && data.encoding === "base64") {
      readmeExcerpt = extractReadmeExcerpt(data.content);
    }
  }

  const body: RepoEnrichment = RepoEnrichmentSchema.parse({
    ownerTwitterUsername,
    ownerBlog,
    readmeExcerpt,
    // GitHub generates a 1280x640 social preview at this stable URL. The
    // first path segment is a cache buster — any value works; "1" keeps the
    // cache hit rate high without revealing internal state.
    ogImageUrl: `https://opengraph.githubassets.com/1/${owner}/${repo}`,
  });

  if (r) {
    await r.set(cacheKey, JSON.stringify(body), "EX", CACHE_TTL_SECONDS);
  }

  return privateNoStoreJson(body, { headers: { "x-cache": "MISS" } });
}

function isSafeSegment(s: string): boolean {
  // GitHub login + repo name spec: alphanumeric, dash, underscore, dot.
  return /^[A-Za-z0-9_.-]{1,100}$/.test(s);
}

function nullIfEmpty(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Pull the first prose paragraph out of a README.
 *
 * Skips frontmatter, HTML comments, badge-only lines (image-only or
 * link-wrapped image), heading lines, and HTML tag lines. Stops at the first
 * blank line after collecting prose. Strips inline markdown markup so the
 * excerpt looks reasonable as a token description.
 */
function extractReadmeExcerpt(base64: string): string | null {
  let raw: string;
  try {
    raw = Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }

  // Strip frontmatter (--- ... ---) at the top.
  raw = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  // Strip HTML comments anywhere.
  raw = raw.replace(/<!--[\s\S]*?-->/g, "");

  const lines = raw.split(/\r?\n/);
  const collected: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (started) break;
      continue;
    }
    if (isSkippableLine(trimmed)) {
      if (started) break;
      continue;
    }
    started = true;
    collected.push(trimmed);
  }

  if (collected.length === 0) return null;

  let text = collected.join(" ");
  // Strip inline markdown: links, images, bold/italic, inline code, headings.
  text = text
    .replace(/!\[[^\]]*]\([^)]+\)/g, "") // images
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1") // links → label
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/^#+\s*/, "") // leading heading marks
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  if (text.length <= README_EXCERPT_MAX) return text;
  // Cut at a word boundary near the limit.
  const cut = text.slice(0, README_EXCERPT_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function isSkippableLine(line: string): boolean {
  if (line.startsWith("#")) return true;
  if (line.startsWith("<") && line.endsWith(">")) return true;
  // Badge-only line: one or more inline images, optionally wrapped in links,
  // separated by whitespace, with nothing else.
  const stripped = line
    .replace(/\[!\[[^\]]*]\([^)]+\)]\([^)]+\)/g, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .trim();
  if (stripped.length === 0) return true;
  return false;
}
