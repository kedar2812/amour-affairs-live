"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { TimeRange } from "@/data/mockChartData";
import { useLeads } from "@/lib/useData";
import { buildFunnel } from "@/lib/analytics";

/*
 * Lead conversion funnel — for each stage, how many leads reached it (are at
 * it or further along). Drop-offs and the overall % (Won ÷ inquiries) are
 * therefore true conversion figures, not a snapshot of where leads sit today.
 */

export function FunnelChart() {
  const [activeToggle, setActiveToggle] = useState<TimeRange>("Month");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { data: leads } = useLeads();

  const currentData = buildFunnel((leads as any[]) || [], activeToggle);
  const maxCount = currentData[0]?.count || 0;
  const totalConversion = maxCount ? ((currentData[currentData.length - 1].count / maxCount) * 100).toFixed(1) : "0";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.16 }}
      className="h-full relative"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="dash-card-title">Conversion Funnel</h3>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="popLayout">
                <motion.span 
                  key={activeToggle}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md"
                >
                  {totalConversion}% overall
                </motion.span>
              </AnimatePresence>
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-2 py-1 rounded-md font-medium transition-colors"
                >
                  {activeToggle}
                  <ChevronDown className="h-3 w-3" />
                </button>
                {isDropdownOpen && (
                   <div className="absolute top-full mt-1 right-0 w-24 bg-card border border-border/50 shadow-lg rounded-lg py-1 z-50">
                      {(["Week", "Month", "Year", "Max"] as TimeRange[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setActiveToggle(t); setIsDropdownOpen(false); }}
                          className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted font-medium text-foreground transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                   </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">Inquiry → Delivery pipeline</p>
        </div>

        <div className="flex-1 px-6 pb-6 flex flex-col justify-center gap-3">
          <AnimatePresence mode="popLayout">
            {currentData.map((step, index) => {
              const widthPct = maxCount ? (step.count / maxCount) * 100 : 0;
              const prevCount = index > 0 ? currentData[index - 1].count : null;
              const dropOff = prevCount ? ((1 - step.count / prevCount) * 100).toFixed(0) : null;

              return (
                <motion.div 
                  key={step.stage}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Drop-off between stages */}
                  {dropOff && (
                    <motion.div 
                      key={`dropoff-${step.stage}`}
                      layout
                      className="flex items-center text-[11px] text-muted-foreground pl-8 pb-1 gap-1"
                    >
                      <span>↓</span>
                      <span className="text-destructive font-medium">-{dropOff}%</span>
                    </motion.div>
                  )}
                  <div className="flex items-center gap-3">
                    {/* Step number */}
                    <div
                      className="w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 bg-muted text-muted-foreground"
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-foreground truncate">{step.stage}</span>
                        <AnimatePresence mode="popLayout">
                          <motion.span 
                            key={step.count}
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                            className="text-[13px] font-bold text-foreground"
                          >
                             {step.count}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="h-full rounded-full"
                          style={{ background: step.color }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
