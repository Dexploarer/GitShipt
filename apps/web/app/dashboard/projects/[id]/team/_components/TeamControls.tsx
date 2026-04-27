"use client";

import * as React from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button, Input } from "@repo/ui";
import { addProjectMember, removeProjectMember } from "../../actions";

export function MemberInviteForm({ projectId }: { projectId: string }) {
  const [lookup, setLookup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await addProjectMember({
        projectId,
        lookup,
        role: "project_moderator",
        idempotencyKey: `team-add-${projectId}-${Date.now()}`,
      });
      setLookup("");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={lookup}
        onChange={(event) => setLookup(event.target.value)}
        placeholder="GitHub username or email"
        aria-label="GitHub username or email"
        className="min-w-0"
      />
      <Button
        type="submit"
        variant="primary"
        disabled={busy || lookup.trim().length === 0}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UserPlus className="size-4" />
        )}
        Add moderator
      </Button>
      {error ? (
        <p className="text-body-sm text-danger sm:basis-full">{error}</p>
      ) : null}
      {saved ? (
        <p className="text-body-sm text-success sm:basis-full" role="status">
          Member access saved.
        </p>
      ) : null}
    </form>
  );
}

export function MemberRemoveButton({
  projectId,
  userId,
  disabled,
}: {
  projectId: string;
  userId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onRemove() {
    const ok = window.confirm("Remove this member from the project?");
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await removeProjectMember({
        projectId,
        userId,
        idempotencyKey: `team-remove-${projectId}-${userId}-${Date.now()}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={disabled || busy}
        title={
          disabled
            ? "Project owners are removed through ownership transfer."
            : "Remove member"
        }
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        Remove
      </Button>
      {error ? (
        <span className="max-w-48 text-right text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
