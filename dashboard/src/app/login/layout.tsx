import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Amour Affairs Studio Dashboard",
  description: "Sign in to the Amour Affairs Photography studio management dashboard.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page uses its own full-screen layout — no sidebar/header
  return children;
}
