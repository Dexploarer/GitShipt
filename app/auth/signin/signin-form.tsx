"use client";

import Link from "next/link";
import { Github, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useSearchParams } from "next/navigation";

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGithub() {
    setLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: next,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-popover">
        <Link href="/" className="mb-6 inline-flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-bg">
            <Sparkles className="size-4" />
          </span>
          <span className="text-headline-sm tracking-tight">GitBags</span>
        </Link>

        <h1 className="text-headline-md">Sign in</h1>
        <p className="mt-2 text-body-md text-fg-secondary">
          Connect your GitHub account. We use your repo access to verify
          ownership when you launch a token.
        </p>

        <button
          type="button"
          onClick={handleGithub}
          disabled={isLoading}
          className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-label-md text-fg transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Github className="size-4" />
          )}
          Continue with GitHub
        </button>

        {error ? (
          <p className="mt-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-body-sm text-danger">
            {error}
          </p>
        ) : null}

        <p className="mt-8 text-caption text-fg-muted">
          By signing in, you agree to the{" "}
          <Link href="/legal/terms" className="text-fg-secondary hover:text-fg">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-fg-secondary hover:text-fg">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
