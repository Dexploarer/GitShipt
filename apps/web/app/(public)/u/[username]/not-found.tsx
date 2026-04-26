import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ContributorNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <EmptyState
        icon={SearchX}
        title="Contributor not found"
        description="We don't have any leaderboard data for that GitHub user yet."
        cta={{ label: "Browse projects", href: "/explore" }}
        secondary={{ label: "Go home", href: "/" }}
      />
    </main>
  );
}
