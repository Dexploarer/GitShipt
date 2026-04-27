"use client";

import * as React from "react";
import { BookOpen, Eye, Save } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { MarkdownPreview } from "@/components/shared/MarkdownPreview";
import { updateProjectDocs } from "../../actions";

export function ProjectDocsEditor({
  projectId,
  initialMarkdown,
  initialPublished,
  updatedAt,
}: {
  projectId: string;
  initialMarkdown: string;
  initialPublished: boolean;
  updatedAt: string | null;
}) {
  const [markdown, setMarkdown] = React.useState(initialMarkdown);
  const [published, setPublished] = React.useState(initialPublished);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateProjectDocs({
        projectId,
        markdown,
        published,
        idempotencyKey: `docs-${projectId}-${Date.now()}`,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save docs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <Card depth="flat" padding="none">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-fg-secondary" /> Authoring
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-label-sm text-fg-secondary">Markdown</span>
              <textarea
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                rows={18}
                className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-body-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="# Contributor guide&#10;&#10;Explain how to contribute, what counts, and where payouts go."
              />
            </label>

            <label className="flex items-center gap-2 text-body-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
                className="size-4 accent-primary"
              />
              Publish on the public project docs page
            </label>

            {error ? (
              <p className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-body-sm text-danger">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p className="text-body-sm text-success" role="status">
                Docs saved.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <span className="text-caption text-fg-muted">
                {updatedAt
                  ? `Last saved ${new Date(updatedAt).toLocaleString()}`
                  : "Not saved yet"}
              </span>
              <Button type="submit" variant="primary" disabled={busy}>
                <Save className="size-4" />
                {busy ? "Saving..." : "Save docs"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card depth="flat" padding="none">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-4 text-fg-secondary" /> Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <MarkdownPreview
            markdown={markdown}
            emptyLabel="Start writing to preview the public docs."
          />
        </CardContent>
      </Card>
    </div>
  );
}
