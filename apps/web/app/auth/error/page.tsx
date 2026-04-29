import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessages: Record<string, string> = {
    auth_callback_failed: "Authentication failed. Please try signing in again.",
    access_denied: "Access was denied. You may have cancelled the sign-in process.",
    invalid_request: "Invalid authentication request. Please try again.",
    server_error: "A server error occurred. Please try again later.",
  };

  const message = error
    ? errorMessages[error] || "An unknown error occurred during authentication."
    : "An unknown error occurred during authentication.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Authentication Error
          </h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/auth/signin">Try Again</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
