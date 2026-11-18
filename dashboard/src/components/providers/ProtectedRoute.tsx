"use client";

import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

/**
 * Wraps authenticated pages — redirects to /login if not authenticated.
 * Shows a loading spinner while checking auth state.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      window.location.href = "/login";
    }
  }, [isLoggedIn, isLoading]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
