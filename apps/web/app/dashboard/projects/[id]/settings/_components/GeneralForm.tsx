"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import { FormError } from "@/components/shared/FormError";
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
        toast.success("Project metadata saved");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {error ? (
        <FormError message={error} onDismiss={() => setError(null)} />
      ) : null}

      <FormField label="Display name" htmlFor="general-name" required>
        <Input
          id="general-name"
          type="text"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>

      <FormField label="Description" htmlFor="general-description">
        <textarea
          id="general-description"
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body-md text-fg outline-none focus:border-primary"
        />
      </FormField>

      <FormField label="Image URL" htmlFor="general-image-url">
        <Input
          id="general-image-url"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </FormField>

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
