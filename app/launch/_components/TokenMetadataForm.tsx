"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/FormField";
import { TokenMetadataSchema, type TokenMetadataInput, type GithubRepo } from "@/shared";

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
    formState: { errors, isValid },
  } = useForm<TokenMetadataInput>({
    resolver: zodResolver(ClientTokenSchema),
    mode: "onBlur",
    defaultValues:
      initial ?? {
        name: repo.name.slice(0, 32),
        symbol: deriveSymbol(repo.name),
        description: repo.description ?? "",
        imageUrl: repo.ownerAvatarUrl,
      },
  });

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
          className="text-mono-md uppercase tracking-wide"
          {...register("symbol", {
            setValueAs: (v: string) => (v ?? "").toUpperCase(),
          })}
        />
      </FormField>

      <FormField
        label="Description"
        hint="Optional. Up to 2000 characters. Shows on Bags.fm and your project page."
        error={errors.description?.message}
      >
        <textarea
          rows={4}
          maxLength={2000}
          {...register("description")}
          className={cn(
            "w-full rounded-md border border-border-strong bg-surface px-3 py-2",
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

function deriveSymbol(repoName: string): string {
  const cleaned = repoName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10) || "GBAGS";
}
