"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAuditCsv } from "@/app/admin/actions";

export function ExportAuditButton({
  prefix,
  sinceMs,
}: {
  prefix?: string;
  sinceMs: number;
}) {
  const [busy, setBusy] = React.useState(false);

  async function handle() {
    setBusy(true);
    try {
      const res = await exportAuditCsv({ prefix, sinceMs });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${new Date().toISOString().slice(0, 19)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={handle} variant="secondary" size="sm" disabled={busy}>
      <Download className="size-4" /> {busy ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
