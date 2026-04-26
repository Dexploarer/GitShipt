import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      description="We couldn't find that admin resource."
      cta={{ label: "Back to admin", href: "/admin" }}
    />
  );
}
