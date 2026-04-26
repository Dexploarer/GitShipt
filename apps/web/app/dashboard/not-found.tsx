import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function DashboardNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      description="We couldn't find that page in your dashboard."
      cta={{ label: "Back to dashboard", href: "/dashboard" }}
    />
  );
}
