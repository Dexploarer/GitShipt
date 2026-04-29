"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui";
import { deleteProject } from "../../actions";

export function DangerSection({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    setError(null);
    if (confirm !== slug) {
      setError(`Type "${slug}" exactly to confirm.`);
      return;
    }
    startTransition(async () => {
      try {
        await deleteProject({
          projectId,
          confirmSlug: confirm,
          idempotencyKey: `delete-${projectId}`,
        });
        // deleteProject redirects to /dashboard on success — no success toast
        // (the redirect would unmount the toaster's host before it appears).
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        setError(message);
        toast.error(message);
      }
    });
  }

  if (!confirmOpen) {
    return (
      <Button
        type="button"
        variant="danger"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-4" /> Delete project
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-danger/40 bg-danger-soft px-4 py-3">
      <p className="text-body-sm text-fg">
        This marks the project killed. To confirm, type{" "}
        <code className="rounded bg-surface px-1.5 py-0.5 text-mono-sm text-danger">
          {slug}
        </code>{" "}
        below.
      </p>
      <input
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={slug}
        className="w-full max-w-sm rounded-md border border-danger/60 bg-surface px-3 py-2 text-mono-md text-fg outline-none focus:border-danger"
      />
      {error ? (
        <p className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          disabled={pending || confirm !== slug}
        >
          <Trash2 className="size-4" />
          {pending ? "Deleting..." : "Confirm delete"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setConfirmOpen(false);
            setConfirm("");
            setError(null);
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
