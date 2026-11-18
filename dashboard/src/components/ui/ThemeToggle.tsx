"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[68px] h-10 rounded-full border border-border/50 bg-card" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center w-[68px] h-10 rounded-full p-1 bg-white dark:bg-card border border-border/50 shadow-sm focus:outline-none transition-colors duration-300 group"
      aria-label="Toggle Dark Mode"
    >
      <motion.div
        className="absolute w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md dark:shadow-[0_0_12px_rgba(200,149,108,0.4)]"
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        initial={false}
        animate={{
          x: isDark ? 28 : 0,
        }}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-white dark:text-[#1A1A2E]" strokeWidth={2.5} />
        ) : (
          <Sun className="h-4 w-4 text-white" strokeWidth={2.5} />
        )}
      </motion.div>
      
      {/* Background Icons for visual feedback */}
      <div className="w-full flex justify-between px-2.5 items-center pointer-events-none">
        <Sun className={`h-4 w-4 transition-colors duration-300 ${isDark ? 'text-muted-foreground/50' : 'opacity-0'}`} />
        <Moon className={`h-4 w-4 transition-colors duration-300 ${isDark ? 'opacity-0' : 'text-muted-foreground/50'}`} />
      </div>
    </button>
  );
}
