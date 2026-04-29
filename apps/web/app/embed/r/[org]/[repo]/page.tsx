import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjectPageData } from "@/lib/queries/project-page";
import { getTokenStats } from "@/lib/queries/token-stats";
import { TokenInfoCard } from "@/app/r/[org]/[repo]/_components/TokenInfoCard";

/**
 * Embed widget page — minimal chrome, designed to be loaded inside an
 * <iframe> on a third-party site. Renders just the TokenInfoCard against
 * a transparent background so the host site's color scheme can show
 * through if desired.
 *
 * Default iframe size emitted by EmbedCopyButton: 380x360.
 *
 * Robots: noindex,nofollow — embeds shouldn't show up as standalone
 * results in search engines.
 */
type Params = { org: string; repo: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { org, repo } = await params;
  return {
    title: `${org}/${repo} · GitShipt embed`,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedTokenPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { org, repo } = await params;
  const data = await getProjectPageData(org, repo);
  if (!data) notFound();
  const stats = await getTokenStats(data.header);

  return (
    <div className="bg-bg p-3">
      <TokenInfoCard
        stats={stats}
        ghOwner={data.header.ghOwner}
        ghRepo={data.header.ghRepo}
      />
    </div>
  );
}
