"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transferOwnership } from "../../actions";

export function TransferForm({ projectId }: { projectId: string }) {
  const [username, setUsername] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!username.trim()) {
      setError("Enter the new owner's GitHub username.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await transferOwnership({
          projectId,
          newOwnerGithubUsername: username.trim(),
          idempotencyKey: `transfer-${projectId}-${Date.now()}`,
        });
        setSuccess(`Ownership transferred to user ${res.newOwnerUserId}.`);
        setUsername("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-label-sm text-fg-secondary">
          New owner GitHub username
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={80}
          placeholder="octocat"
          className="w-full max-w-sm rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
        />
      </label>
      {error ? (
        <p className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-body-sm text-success" role="status">
          {success}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          <ArrowRight className="size-4" />
          {pending ? "Transferring..." : "Transfer ownership"}
        </Button>
      </div>
    </form>
  );
}
