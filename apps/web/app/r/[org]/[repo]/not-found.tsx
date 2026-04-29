import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ProjectNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <EmptyState
        icon={SearchX}
        title="Project not found"
        description="We couldn't find that GitHub repository on GitShipt."
        cta={{ label: "Browse projects", href: "/explore" }}
        secondary={{ label: "Go home", href: "/" }}
      />
    </main>
  );
}
