import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import type { IncorporationProject } from "@/lib/bags/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { formatAddress } from "@repo/lib";

export function IncorporationStatusCard({
  tokenMint,
  incorporation,
  action,
}: {
  tokenMint: string | null;
  incorporation: IncorporationProject | null;
  action?: React.ReactNode;
}) {
  const founders = incorporation?.founders ?? [];
  const started = Boolean(incorporation?.incorporationStarted);
  const ready = Boolean(incorporation?.isReadyForIncorporation);

  return (
    <Card depth="flat" padding="none">
      <CardHeader className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Incorporation</CardTitle>
            <CardDescription>
              Bags-hosted formation status for tokenized projects.
            </CardDescription>
          </div>
          <Badge
            variant={ready ? "success" : started ? "warning" : "default"}
            size="sm"
          >
            {ready ? "Ready" : started ? "In progress" : "Not started"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        {tokenMint ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusMetric
                label="Token"
                value={formatAddress(tokenMint, 5, 5)}
                title={tokenMint}
              />
              <StatusMetric
                label="Bags status"
                value={incorporation?.incorporationStatus ?? "Not started"}
              />
              <StatusMetric
                label="Equity share"
                value={
                  incorporation?.incorporationShareBasisPoint
                    ? `${(incorporation.incorporationShareBasisPoint / 100).toFixed(1)}%`
                    : "--"
                }
              />
            </div>

            <p className="text-body-sm text-fg-secondary">
              GitBags does not collect founder KYC, residential addresses, tax
              residency, or identity documents.
            </p>

            {founders.length > 0 ? (
              <div className="space-y-2">
                {founders.map((founder, index) => (
                  <div
                    key={founder.founderId ?? founder.id ?? index}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-elevated/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-label-sm text-fg">
                        Founder {index + 1}
                      </div>
                      <div className="text-mono-sm text-fg-muted">
                        {founder.kycStatus ?? "pending"} /{" "}
                        {(founder.shareBasisPoint / 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {founder.formUrl ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={founder.formUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Resume form <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : null}
                      {founder.kycUrl ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link
                            href={founder.kycUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Resume KYC <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {action ? <div>{action}</div> : null}
          </>
        ) : (
          <div className="flex items-start gap-3 text-body-md text-fg-secondary">
            <Building2 className="mt-0.5 size-4 text-fg-muted" />
            Finish token setup before starting incorporation.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusMetric({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
      <div className="text-caption text-fg-muted">{label}</div>
      <div className="mt-1 truncate text-mono-md text-fg" title={title}>
        {value}
      </div>
    </div>
  );
}
