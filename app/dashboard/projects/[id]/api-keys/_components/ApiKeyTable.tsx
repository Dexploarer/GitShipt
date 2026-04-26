import { KeyRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/format";
import type { ApiKeyListItem } from "@/lib/queries/api-keys";
import { RevokeButton } from "./RevokeButton";

export interface ApiKeyTableProps {
  projectId: string;
  keys: ApiKeyListItem[];
}

/**
 * Server component that lists active (non-revoked) API keys for a project.
 * The raw key is never available here — only the prefix + last-4 plaintext
 * fragments stored at creation time.
 */
export function ApiKeyTable({ projectId, keys }: ApiKeyTableProps) {
  if (keys.length === 0) {
    return (
      <Card depth="flat" padding="none">
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <KeyRound className="size-8 text-fg-muted" aria-hidden />
          <p className="text-body-md text-fg-secondary">
            No active API keys for this project yet.
          </p>
          <p className="text-caption text-fg-muted">
            Mint one above to start querying leaderboard / payout data
            programmatically.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card depth="flat" padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-surface-elevated/40">
            <tr className="text-label-sm text-fg-secondary">
              <th scope="col" className="px-5 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Key
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Created
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Last used
              </th>
              <th scope="col" className="px-5 py-3 font-medium text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-5 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <span className="text-body-md text-fg">{k.name}</span>
                    <Badge variant="info" size="sm">
                      read
                    </Badge>
                  </div>
                </td>
                <td className="px-5 py-3 align-middle text-mono-sm text-fg-secondary">
                  {k.prefix}…{k.lastFourPlain}
                </td>
                <td className="px-5 py-3 align-middle text-mono-sm text-fg-secondary">
                  {formatRelativeTime(k.createdAt)}
                </td>
                <td className="px-5 py-3 align-middle text-mono-sm text-fg-secondary">
                  {k.lastUsedAt ? formatRelativeTime(k.lastUsedAt) : "—"}
                </td>
                <td className="px-5 py-3 align-middle text-right">
                  <RevokeButton
                    projectId={projectId}
                    keyId={k.id}
                    keyName={k.name}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
