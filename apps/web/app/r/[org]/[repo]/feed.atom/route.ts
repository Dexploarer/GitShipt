import { notFound } from "next/navigation";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getProjectFeedAtomData } from "@/lib/queries/project-feed";
import { clientEnv } from "@/lib/env";

/**
 * Atom 1.0 syndication for /r/[org]/[repo]/feed.
 *
 * Atom (over RSS) because:
 *   - Atom requires explicit `id` and unambiguous timestamps; both align
 *     with our row schema.
 *   - Wide reader support (Reeder, NetNewsWire, Inoreader, RSS-aware
 *     bots like the GitHub digest crawlers).
 *
 * The body is the templated body_md from project_feed_entries — same prose
 * the React card renders, served as plain markdown inside the <content>
 * element. Readers that don't render markdown still see the structure;
 * readers that do (most modern ones) render headings + bullets nicely.
 *
 * Cache for `browse` cadence (~120s) on the data side; the route returns
 * Cache-Control headers so a CDN can shed load.
 */

type Params = Promise<{ org: string; repo: string }>;

export async function GET(
  _req: Request,
  context: { params: Params },
): Promise<Response> {
  const { org, repo } = await context.params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();

  const { header } = data;
  const slug = `${header.ghOwner}/${header.ghRepo}`;
  // Resolve base URL from env so dev / preview / prod all generate
  // correct self/alternate links. Falls back to localhost via the schema
  // default in env.ts when the var isn't set.
  const baseUrl = clientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const siteUrl = `${baseUrl}/r/${slug}`;
  const selfUrl = `${siteUrl}/feed.atom`;
  const feedUrl = `${siteUrl}/feed`;

  // Tag URN for the feed and per-entry IDs. RFC 4151 says the tag scheme
  // gives you globally unique IDs that don't depend on URL stability — if
  // we ever rename the domain or the path, atom readers won't see entries
  // as "new" again. Authority is the platform domain at first launch
  // (gitshipt.com); the date component pins the schema's birthdate so
  // future re-coinings produce different namespaces.
  const feedTagId = `tag:gitshipt.com,2026:project-feed/${header.id}`;

  const { entries } = await getProjectFeedAtomData(header.id, 30);

  // updated = newest entry's createdAt, or project's createdAt as fallback.
  const updated =
    entries[0]?.createdAt.toISOString() ?? header.createdAt.toISOString();

  const xml = renderAtom({
    feedId: feedTagId,
    selfUrl,
    feedUrl,
    title: `${header.name} · GitShipt feed`,
    subtitle: `Daily digests + milestones for ${slug}, synthesized from the leaderboard and indexed git history.`,
    updated,
    entries: entries.map((e) => ({
      // Stable URN: doesn't depend on the public URL or the project's slug.
      // Row id is opaque + immutable, so this id is permanent across renames.
      id: `tag:gitshipt.com,2026:project-feed/entry/${e.id}`,
      url: feedUrl,
      title: titleFor(e),
      updated: e.createdAt.toISOString(),
      published: e.createdAt.toISOString(),
      // Markdown content. Atom 1.0 supports type="text", "html", "xhtml".
      // Markdown isn't a registered type; we ship as text and let readers
      // that render markdown opt in.
      contentType: "text",
      content: e.bodyMd,
    })),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      // Match the cacheLife("browse") on the underlying query.
      "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
    },
  });
}

interface AtomEntry {
  id: string;
  url: string;
  title: string;
  updated: string;
  published: string;
  contentType: "text" | "html";
  content: string;
}

function renderAtom(args: {
  feedId: string;
  selfUrl: string;
  feedUrl: string;
  title: string;
  subtitle: string;
  updated: string;
  entries: AtomEntry[];
}): string {
  const { feedId, selfUrl, feedUrl, title, subtitle, updated, entries } = args;
  const entriesXml = entries
    .map(
      (e) => `  <entry>
    <id>${escapeXml(e.id)}</id>
    <title>${escapeXml(e.title)}</title>
    <link rel="alternate" href="${escapeXml(e.url)}"/>
    <updated>${escapeXml(e.updated)}</updated>
    <published>${escapeXml(e.published)}</published>
    <content type="${e.contentType}">${escapeXml(e.content)}</content>
  </entry>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedId)}</id>
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <link rel="self" href="${escapeXml(selfUrl)}"/>
  <link rel="alternate" href="${escapeXml(feedUrl)}"/>
  <updated>${escapeXml(updated)}</updated>
  <generator>GitShipt</generator>
${entriesXml}
</feed>
`;
}

function titleFor(entry: { kind: string; period: string | null }): string {
  if (entry.kind === "period_digest" && entry.period) {
    return `Period digest · ${entry.period}`;
  }
  return entry.kind.replace(/_/g, " ");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
