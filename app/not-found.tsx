import { Frown } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Generic 404 — rendered when no route matches and no closer not-found.tsx
 * is provided.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <EmptyState
        icon={Frown}
        title="Page not found"
        description="This page doesn't exist or may have been moved."
        cta={{ label: "Go home", href: "/" }}
        secondary={{ label: "Browse projects", href: "/explore" }}
      />
    </main>
  );
}
