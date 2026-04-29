import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";


export default function DashboardApiKeysPage() {
  return (
    <div className="mx-auto w-full max-w-content">
      <EmptyState
        icon={KeyRound}
        title="API keys are project scoped"
        description="Open a project console to create, revoke, or rotate keys for that repository."
        cta={{ label: "View projects", href: "/dashboard/projects" }}
      />
    </div>
  );
}
