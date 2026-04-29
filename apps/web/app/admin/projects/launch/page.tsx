import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth/page-guards";
import { DirectLaunchForm } from "./_components/DirectLaunchForm";


export default function AdminLaunchBypassPage() {
  return (
    <Suspense fallback={null}>
      <AdminLaunchBypassPageContent />
    </Suspense>
  );
}

async function AdminLaunchBypassPageContent() {
  await requireAdminPage("admin.direct_launch", "/admin");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-headline-md">Direct launch bypass</h1>
        <p className="text-body-sm text-fg-secondary">
          Super-admin audited launch path for verified exceptions and operator
          recovery.
        </p>
      </header>

      <DirectLaunchForm />
    </div>
  );
}
