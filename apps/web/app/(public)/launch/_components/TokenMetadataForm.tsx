"use client";

import * as React from "react";
import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { cn } from "@repo/lib";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { FormField } from "@/components/shared/FormField";
import {
  TokenMetadataSchema,
  type TokenMetadataInput,
  type GithubRepo,
} from "@repo/shared";
import {
  deriveSymbolFromRepo,
  deriveTokenMetadataDefaults,
} from "@/lib/state/launch-wizard-store";

/**
 * Client-side schema layered on top of the shared Zod contract.
 *
 *   - Mirrors `TokenMetadataSchema` for `name`, `description`, `imageUrl`.
 *   - Tightens `symbol` to a 2-10 uppercase-and-digit constraint per the
 *     wizard polish spec (the server still accepts 1-10 from the canonical
 *     schema; this is a stricter UX hint, not a security boundary).
 *
 * Important: the form's submit shape is unchanged — the same TokenMetadataInput
 * is posted to the server action.
 */
const ClientTokenSchema = TokenMetadataSchema.extend({
  symbol: z
    .string()
    .trim()
    .min(2, "Symbol must be at least 2 characters")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
});

export interface TokenMetadataFormProps {
  repo: GithubRepo;
  initial: TokenMetadataInput | null;
  onBack: () => void;
  onSubmit: (data: TokenMetadataInput) => void;
}

export function TokenMetadataForm({
  repo,
  initial,
  onBack,
  onSubmit,
}: TokenMetadataFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<TokenMetadataInput>({
    resolver: zodResolver(ClientTokenSchema),
    mode: "onBlur",
    defaultValues: initial ?? deriveTokenMetadataDefaults(repo),
  });
  const preview = useWatch({ control });
  const previewImage = safeImageUrl(preview.imageUrl, repo.ownerAvatarUrl);

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data))}
      className="space-y-6"
    >
      <header className="space-y-2">
        <h2 className="text-headline-sm">Token metadata</h2>
        <p className="text-body-md text-fg-secondary">
          These appear on Bags.fm and your project page. Symbol is uppercase
          letters and numbers only — pick something traders can type.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <FormField
              label="Name"
              hint="Up to 32 characters."
              error={errors.name?.message}
              required
            >
              <Input
                type="text"
                maxLength={32}
                autoComplete="off"
                {...register("name")}
              />
            </FormField>

            <FormField
              label="Symbol"
              hint="A-Z, 0-9 only. 2-10 characters."
              error={errors.symbol?.message}
              required
            >
              <Input
                type="text"
                maxLength={10}
                autoComplete="off"
                className="text-mono-md uppercase"
                {...register("symbol", {
                  setValueAs: (v: string) => (v ?? "").toUpperCase(),
                })}
              />
            </FormField>
          </div>

          <FormField
            label="Description"
            hint="Required. Up to 1000 characters. Shows on Bags.fm and your project page."
            error={errors.description?.message}
            required
          >
            <textarea
              rows={7}
              maxLength={1000}
              {...register("description")}
              className={cn(
                "w-full resize-none rounded-md border border-border-strong bg-surface px-3 py-2",
                "text-body-md text-fg outline-none placeholder:text-fg-muted",
                "transition-[border-color,box-shadow] duration-150",
                "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-inset-light",
                "aria-[invalid=true]:border-danger",
              )}
            />
          </FormField>

          <FormField
            label="Image URL"
            hint="Square image works best. Defaults to your GitHub avatar."
            error={errors.imageUrl?.message}
            required
          >
            <Input type="url" autoComplete="off" {...register("imageUrl")} />
          </FormField>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded-lg border border-border bg-surface-elevated/40 p-4">
            <div className="flex items-start gap-3">
              <Image
                src={previewImage}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="size-12 shrink-0 rounded-lg bg-surface object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-label-md text-fg">
                  {preview.name || repo.name}
                </p>
                <p className="text-mono-sm text-fg-muted">
                  ${preview.symbol || deriveSymbolFromRepo(repo.name)}
                </p>
                <p className="mt-2 line-clamp-4 text-body-sm text-fg-secondary">
                  {preview.description || defaultDescription(repo)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <FormField
              label="Website"
              hint="Optional."
              error={errors.website?.message}
            >
              <Input type="url" autoComplete="off" {...register("website")} />
            </FormField>
            <FormField
              label="X / Twitter"
              hint="Optional full URL."
              error={errors.twitter?.message}
            >
              <Input type="url" autoComplete="off" {...register("twitter")} />
            </FormField>
            <FormField
              label="Telegram"
              hint="Optional full URL."
              error={errors.telegram?.message}
            >
              <Input type="url" autoComplete="off" {...register("telegram")} />
            </FormField>
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}

function defaultDescription(repo: GithubRepo): string {
  const description = repo.description?.trim();
  if (description) return description.slice(0, 1000);
  return `Token for ${repo.owner}/${repo.name}. Fees redistribute to top contributors daily.`;
}

function safeImageUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}
