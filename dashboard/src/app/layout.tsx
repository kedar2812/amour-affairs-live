import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/lib/ToastContext";
import { AuthProvider } from "@/lib/AuthContext";
import { DashboardShell } from "@/components/layout/DashboardShell";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amour Affairs | Studio Dashboard",
  description: "Client and operations management dashboard for Amour Affairs Photography",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex bg-background text-foreground h-screen overflow-hidden">
        {/* Always open in light mode regardless of the device theme.
            enableSystem={false} stops it from following the OS dark mode; the
            header toggle still lets the user switch manually if they want. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ToastProvider>
            <AuthProvider>
              <DashboardShell>{children}</DashboardShell>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
