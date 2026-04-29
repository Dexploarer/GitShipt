import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";

import { buildOpenApiSpec } from "@/lib/api-spec";
import { clientEnv } from "@/lib/env";

/**
 * The spec is deterministic given the build — same input shape, same output.
 * Cache the build step inside `'use cache'` so we serve from the cache for
 * the configured cacheLife window without rebuilding the document on each
 * request. The `Cache-Control: public, s-maxage=3600` header gives the edge
 * a parallel hint independent of the in-process cache.
 */
async function getSpec(appUrl: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 3600, expire: 86_400 });
  cacheTag("gitshipt:openapi");
  return buildOpenApiSpec(appUrl);
}

export async function GET(): Promise<Response> {
  const spec = await getSpec(clientEnv().NEXT_PUBLIC_APP_URL);
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
