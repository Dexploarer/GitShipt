import { Rocket } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * Direct-launch bypass — read-only stub for v0.
 *
 * The real wizard skips ownership checks, allowing super-admins to launch a
 * token on behalf of a verified contributor. v1.1 work; the surface lives
 * here so the nav has a permanent home.
 */
export default async function AdminLaunchBypassPage() {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  await requirePermission("admin.access", { userId: session.user.id });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md tracking-tight">Direct launch bypass</h1>
        <p className="text-body-sm text-fg-secondary">
          Launch a token without project-ownership checks. v1.1.
        </p>
      </header>

      <Card depth="raised" padding="default" className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="size-5 text-warning" /> Coming in v1.1
            <Badge variant="warning" size="sm">stub</Badge>
          </CardTitle>
          <CardDescription>
            Today, contributor-verified launches must go through the public
            wizard at{" "}
            <code className="text-mono-sm">/launch</code>. The bypass surface
            here will accept any verified GitHub repo + a Bags fee-claimer
            wallet, then run the same launch state machine without owner consent
            (audited as <code className="text-mono-sm">project.launch</code> with{" "}
            <code className="text-mono-sm">bypass: true</code>).
          </CardDescription>
        </CardHeader>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" size="sm" disabled title="Available in v1.1">
            Launch token
          </Button>
          <span className="text-caption text-fg-muted">Disabled · v1.1</span>
        </div>
      </Card>
    </div>
  );
}
