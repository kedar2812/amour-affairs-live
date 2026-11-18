"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ProtectedRoute } from "@/components/providers/ProtectedRoute";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { RouteProgress } from "@/components/layout/RouteProgress";
import { AnimatePresence } from "framer-motion";

/**
 * DashboardShell conditionally renders the sidebar + header chrome.
 * Login page gets a clean, full-screen layout.
 * All other pages are wrapped in ProtectedRoute.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login page — no shell, no auth check.
  // trailingSlash:true means the static export serves "/login/", so usePathname()
  // returns "/login/" — must match both forms or the login page gets wrapped in
  // ProtectedRoute and rapid-redirect-loops back to itself.
  if (pathname === "/login" || pathname === "/login/") {
    return <>{children}</>;
  }

  // All other pages — full dashboard shell with auth protection
  return (
    <ProtectedRoute>
      {/* Navigation loading indicator */}
      <RouteProgress />

      {/* Sidebar Container */}
      <div className="p-3 pr-0 h-full flex shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative h-full flex flex-col min-w-0">
        {/* Floating Header */}
        <div className="absolute top-0 left-0 right-0 z-50 p-3 pl-3">
          <Header />
        </div>

        {/* Scrollable Content */}
        <main className="flex-1 h-full overflow-y-auto pt-[116px] px-8 pb-12">
          <AnimatePresence mode="wait">
            <PageWrapper key={pathname}>{children}</PageWrapper>
          </AnimatePresence>
        </main>
      </div>
    </ProtectedRoute>
  );
}
