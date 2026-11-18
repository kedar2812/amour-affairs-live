"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A thin top progress bar + brief overlay shimmer that appears whenever the
 * route changes, so navigation always gives visible feedback ("something is
 * loading — wait a moment") instead of feeling frozen. This is a static-export
 * SPA, so we drive it off pathname changes rather than Next's loading.tsx.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't flash the bar on the very first mount.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    // Long enough to read as a deliberate transition, short enough to feel snappy.
    timer.current = setTimeout(() => setLoading(false), 650);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <>
          {/* Top progress bar */}
          <motion.div
            key="bar"
            className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="h-full bg-primary shadow-[0_0_10px_var(--primary)]"
              initial={{ width: "0%" }}
              animate={{ width: ["0%", "35%", "70%", "90%"] }}
              transition={{ duration: 0.65, ease: "easeOut", times: [0, 0.3, 0.6, 1] }}
            />
          </motion.div>

          {/* Corner spinner so the feedback is visible even mid-page */}
          <motion.div
            key="spinner"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-4 right-4 z-[200] pointer-events-none"
          >
            <div className="h-6 w-6 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
