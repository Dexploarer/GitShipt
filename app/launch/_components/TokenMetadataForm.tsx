"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TokenMetadataSchema,
  type TokenMetadataInput,
  type GithubRepo,
} from "@/shared";

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
    resolver: zodResolver(TokenMetadataSchema),
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

      <Field
        id="name"
        label="Name"
        help="Up to 32 characters."
        error={errors.name?.message}
      >
        <input
          id="name"
          type="text"
          maxLength={32}
          {...register("name")}
          className={inputClass}
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <Field
        id="symbol"
        label="Symbol"
        help="A-Z, 0-9 only. Up to 10 characters."
        error={errors.symbol?.message}
      >
        <input
          id="symbol"
          type="text"
          maxLength={10}
          {...register("symbol", {
            setValueAs: (v: string) => (v ?? "").toUpperCase(),
          })}
          className={cn(inputClass, "text-mono-md uppercase tracking-wide")}
          aria-invalid={Boolean(errors.symbol)}
        />
      </Field>

      <Field
        id="description"
        label="Description"
        help="Optional. Up to 2000 characters. Shows on Bags.fm and your project page."
        error={errors.description?.message}
      >
        <textarea
          id="description"
          rows={4}
          maxLength={2000}
          {...register("description")}
          className={cn(inputClass, "h-auto resize-y py-2 leading-snug")}
          aria-invalid={Boolean(errors.description)}
        />
      </Field>

      <Field
        id="imageUrl"
        label="Image URL"
        help="Square image works best. Defaults to your GitHub avatar."
        error={errors.imageUrl?.message}
      >
        <input
          id="imageUrl"
          type="url"
          {...register("imageUrl")}
          className={inputClass}
          aria-invalid={Boolean(errors.imageUrl)}
        />
      </Field>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-elevated px-4 text-label-md text-fg transition-colors hover:bg-surface-overlay"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="submit"
          disabled={!isValid}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-label-md text-fg transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          Continue
          <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-label-sm text-fg-secondary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-caption text-danger">{error}</p>
      ) : help ? (
        <p className="mt-1 text-caption text-fg-muted">{help}</p>
      ) : null}
    </div>
  );
}

const inputClass = cn(
  "h-10 w-full rounded-md border border-border-strong bg-surface px-3",
  "text-body-md text-fg outline-none placeholder:text-fg-muted",
  "focus:border-primary",
  "aria-[invalid=true]:border-danger",
);

function deriveSymbol(repoName: string): string {
  const cleaned = repoName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10) || "GBAGS";
}
