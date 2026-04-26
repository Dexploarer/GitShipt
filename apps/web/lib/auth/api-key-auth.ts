import "server-only";
import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/queries/api-keys";
import type { ApiKeyRow } from "@/db/schema";

export type ProjectApiKeyScope = "read" | "write" | "admin";

export function readPresentedApiKey(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  const xApiKey = req.headers.get("x-api-key");
  return xApiKey?.trim() || null;
}

export async function verifyProjectApiKey(
  req: Request,
  projectId: string,
  requiredScope: ProjectApiKeyScope = "read",
): Promise<
  | { ok: true; apiKey: ApiKeyRow }
  | { ok: false; response: NextResponse }
> {
  const presentedKey = readPresentedApiKey(req);
  if (!presentedKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "api_key_required" }, { status: 401 }),
    };
  }

  const apiKey = await verifyApiKey(presentedKey);
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_api_key" }, { status: 401 }),
    };
  }

  if (apiKey.projectId !== projectId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "api_key_wrong_project" },
        { status: 403 },
      ),
    };
  }

  const scopes = apiKey.scopes ?? [];
  if (!scopes.includes("*") && !scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "api_key_scope_denied" },
        { status: 403 },
      ),
    };
  }

  return { ok: true, apiKey };
}
