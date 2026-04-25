"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMetadata } from "../../actions";

export function GeneralForm({
  projectId,
  initialName,
  initialDescription,
  initialImageUrl,
}: {
  projectId: string;
  initialName: string;
  initialDescription: string | null;
  initialImageUrl: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateMetadata({
          projectId,
          name,
          description: description.trim() === "" ? null : description.trim(),
          imageUrl: imageUrl.trim() === "" ? null : imageUrl.trim(),
          idempotencyKey: `meta-${projectId}-${Date.now()}`,
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Display name">
        <input
          type="text"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
        />
      </Field>
      <Field label="Image URL">
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
        />
      </Field>
      {error ? (
        <p className="text-body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-body-sm text-success" role="status">
          Metadata saved.
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          <Save className="size-4" />
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-label-sm text-fg-secondary">{label}</span>
      {children}
    </label>
  );
}
