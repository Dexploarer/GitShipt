"use client";

import * as React from "react";
import { ShieldOff, UserCog, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmModal } from "@/components/admin/DestructiveConfirmModal";
import { grantRole, resetUserMfa, sybilFlagUser } from "@/app/admin/actions";

const ROLES = ["user", "moderator", "admin", "super_admin"] as const;
type Role = (typeof ROLES)[number];

export function UserManagePanel({
  userId,
  userName,
  role,
}: {
  userId: string;
  userName: string;
  role: Role;
}) {
  const [open, setOpen] = React.useState(false);
  const [grantOpen, setGrantOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [pendingRole, setPendingRole] = React.useState<Role>(role);
  const [sybilReason, setSybilReason] = React.useState("");
  const [sybilBusy, setSybilBusy] = React.useState(false);
  const [sybilErr, setSybilErr] = React.useState<string | null>(null);

  async function handleSybil() {
    if (sybilReason.trim().length < 20) {
      setSybilErr("Reason must be at least 20 characters.");
      return;
    }
    setSybilBusy(true);
    setSybilErr(null);
    try {
      await sybilFlagUser({ userId, reason: sybilReason.trim() });
      setSybilReason("");
      setOpen(false);
    } catch (e) {
      setSybilErr((e as Error).message);
    } finally {
      setSybilBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        <UserCog className="size-4" /> Manage
      </Button>

      {open ? (
        <div className="mt-2 space-y-3 rounded-md border border-border/60 bg-surface-elevated/60 p-3">
          <div>
            <label className="mb-1 block text-label-sm text-fg-secondary">
              Role
            </label>
            <div className="flex items-center gap-2">
              <select
                value={pendingRole}
                onChange={(e) => setPendingRole(e.target.value as Role)}
                className="rounded-md border border-border bg-bg px-2 py-1 text-body-sm text-fg"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                disabled={pendingRole === role}
                onClick={() => setGrantOpen(true)}
              >
                Grant
              </Button>
            </div>
          </div>

          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <ShieldOff className="size-4" /> Reset MFA
            </Button>
          </div>

          <div className="space-y-2">
            <label className="block text-label-sm text-fg-secondary">
              Sybil flag (audit-only)
            </label>
            <textarea
              value={sybilReason}
              onChange={(e) => setSybilReason(e.target.value)}
              rows={2}
              placeholder="Reason (min 20 chars)"
              className="w-full rounded-md border border-border bg-bg px-2 py-1 text-body-sm text-fg"
            />
            {sybilErr ? (
              <p className="text-caption text-danger">{sybilErr}</p>
            ) : null}
            <Button
              variant="danger"
              size="sm"
              onClick={handleSybil}
              disabled={sybilBusy}
            >
              <AlertTriangle className="size-4" /> Flag as sybil
            </Button>
          </div>
        </div>
      ) : null}

      <DestructiveConfirmModal
        open={grantOpen}
        onOpenChange={setGrantOpen}
        title={`Grant role: ${pendingRole}`}
        description={`This changes ${userName}'s global role from ${role} to ${pendingRole}.`}
        targetName={userName}
        confirmLabel={`Grant ${pendingRole}`}
        action={async (p) => {
          await grantRole({ userId, role: pendingRole, ...p });
        }}
      />

      <DestructiveConfirmModal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset MFA secret"
        description={`Clears ${userName}'s encrypted MFA secret. They must re-enroll on next sign-in.`}
        targetName={userName}
        confirmLabel="Reset MFA"
        action={async (p) => {
          await resetUserMfa({ userId, ...p });
        }}
      />
    </>
  );
}
