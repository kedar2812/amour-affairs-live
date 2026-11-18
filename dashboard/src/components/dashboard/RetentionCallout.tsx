"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, Info, ChevronDown } from "lucide-react";
import { trafficBreakdownData, funnelDataConfig, packagePerformanceData, TimeRange } from "@/data/mockChartData";

/*
 * Zentra-style Insight callout card.
 * Dark gradient background with a prominent statistic and dynamically calculated points linked to global time ranges.
 */
export function RetentionCallout() {
  const [activeToggle, setActiveToggle] = useState<TimeRange>("Month");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 1. Math extraction for the large hero numbers
  const funnel = funnelDataConfig[activeToggle];
  const initialInquiries = Math.max(1, funnel[0].count);
  const bookedShoots = funnel.find(f => f.stage === "Booked")?.count || funnel[funnel.length - 1].count;
  const overallConversion = Math.round((bookedShoots / initialInquiries) * 100);

  const repeatClientRatePct = activeToggle === "Max" ? 42 : activeToggle === "Year" ? 35 : activeToggle === "Month" ? 22 : 12;
  const repeatGrowth = activeToggle === "Max" ? 15 : activeToggle === "Year" ? 8 : activeToggle === "Month" ? 3 : 1;

  // Evaluate "positive" or "negative" for color coding the hero numbers
  const conversionIsPositive = overallConversion >= 10;
  const repeatIsPositive = repeatClientRatePct > 5;

  const conversionColor = conversionIsPositive ? "text-[#00C88C]" : "text-[#b50418]";
  const repeatColor = repeatIsPositive ? "text-[#00C88C]" : "text-[#b50418]";

  const ConversionGraph = conversionIsPositive ? TrendingUp : TrendingDown;
  const RepeatGraph = repeatIsPositive ? TrendingUp : TrendingDown;

  // 2. Lead Sources Logic
  const traffic = trafficBreakdownData[activeToggle];
  const totalTraffic = traffic.reduce((sum, src) => sum + src.value, 0) || 1;
  const sortedTraffic = [...traffic].sort((a, b) => b.value - a.value);
  const leadSourceA = sortedTraffic[0];
  const leadSourceB = sortedTraffic[1];
  const combinedLeadPct = Math.round(((leadSourceA.value + leadSourceB.value) / totalTraffic) * 100);

  // 3. Funnel Drop-off Logic
  let maxDropoffPct = 0;
  let bottleneckEnd = "";
  for (let i = 0; i < funnel.length - 1; i++) {
    const start = Math.max(1, funnel[i].count);
    const drop = (start - funnel[i + 1].count) / start;
    if (drop > maxDropoffPct) {
      maxDropoffPct = drop;
      bottleneckEnd = funnel[i].stage; // Using the start stage name or a combo
    }
  }
  const dropOffRate = Math.round(maxDropoffPct * 100);

  // 4. Package Rev Share Logic
  const pkgs = packagePerformanceData[activeToggle];
  const topPackage = [...pkgs].sort((a, b) => b.revShare - a.revShare)[0];

  // Insights aren't wired to a live pipeline yet, so until there's real funnel
  // data we show an encouraging placeholder instead of computed demo numbers.
  const hasData = funnel.reduce((sum, f) => sum + f.count, 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28 }}
      className="h-full"
    >
      <motion.div 
        className="h-full rounded-2xl relative overflow-hidden text-white group"
        whileHover="hover"
      >
        {/* Layer 1: Base dark luxury deep navy/indigo solid */}
        <div className="absolute inset-0 bg-[#0F0F1A]" />
        
        {/* Layer 2: Animated shifting gradient (mid layer) */}
        <motion.div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, #1A1A2E 0%, #222240 50%, #151528 100%)",
            backgroundSize: "200% 200%",
          }}
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
        />

        {/* Layer 3: Faint noise texture for realism */}
        <div 
          className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        />

        {/* Soft moving spotlight (light sweep/shimmer) */}
        <motion.div
          variants={{
            initial: { opacity: 0.08 },
            hover: { opacity: 0.15 }
          }}
          initial="initial"
          className="absolute inset-0 pointer-events-none"
        >
          <motion.div
            animate={{ x: ["-100%", "100%"], y: ["-20%", "40%"] }}
            transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", repeatType: "reverse" }}
            className="absolute top-0 -left-1/4 w-[150%] h-[150%]"
            style={{ background: "radial-gradient(ellipse at center, rgba(167, 139, 250, 0.4) 0%, transparent 50%)" }}
          />
        </motion.div>

        {/* Ambient Corner Accents */}
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }} 
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-64 h-64 bg-[#C8956C] rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none mix-blend-screen" 
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.10, 0.18, 0.10] }} 
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-500 rounded-full blur-[80px] -ml-16 -mb-16 pointer-events-none mix-blend-screen" 
        />

        {/* Content Container */}
        <div className="relative z-10 p-6 flex flex-col h-full justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#C8956C]">
                <Lightbulb className="h-3.5 w-3.5" />
                Insights
              </div>
              
              {/* Dropdown matched securely to the card's theme */}
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 text-[12px] text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded-md font-medium transition-all backdrop-blur-md shadow-sm"
                >
                  {activeToggle}
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
                {isDropdownOpen && (
                   <div className="absolute top-full mt-1.5 right-0 w-28 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-lg py-1 z-50 overflow-hidden">
                      {(["Week", "Month", "Year", "Max"] as TimeRange[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setActiveToggle(t); setIsDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                   </div>
                )}
              </div>
            </div>
            
            {!hasData ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
                <Lightbulb className="h-9 w-9 text-[#C8956C]/70" />
                <p className="text-[16px] font-semibold text-white/90">No insights yet</p>
                <p className="text-[13px] text-white/55 leading-relaxed max-w-[240px]">
                  Keep using the dashboard for your daily work — add bookings, leads and payments, and insights on conversions, lead sources and client retention will appear here automatically.
                </p>
              </div>
            ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${activeToggle}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Primary Hero Insight */}
                <h2 className={`flex items-center gap-2.5 text-[45px] font-black tracking-tight leading-none mb-2 ${repeatColor}`}>
                  <RepeatGraph className="w-10 h-10" strokeWidth={3} />
                  {repeatClientRatePct}%
                </h2>
                <p className="font-medium text-[16px] leading-snug text-white/85">
                  Repeat client index increased by <span className="text-[#C8956C] font-bold">{repeatGrowth}%</span> vs last {activeToggle.toLowerCase()}.
                </p>

                {/* Secondary Hero Insight */}
                <div className="mt-5">
                  <h2 className={`flex items-center gap-2.5 text-[45px] font-black tracking-tight leading-none mb-2 ${conversionColor}`}>
                    <ConversionGraph className="w-10 h-10" strokeWidth={3} />
                    {overallConversion}%
                  </h2>
                  <p className="font-medium text-[16px] leading-snug text-white/85">
                    Overall funnel conversion rate, yielding <span className="text-[#C8956C] font-bold">{bookedShoots}</span> secured shoots.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
            )}
          </div>

          {hasData && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col gap-3.5 relative overflow-hidden">
             <AnimatePresence mode="wait">
                <motion.div
                  key={`list-${activeToggle}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-3.5"
                >
                  {/* Point 1: Leads */}
                  <div className="flex items-start gap-2.5 group">
                    <div className="mt-0.5 p-1 rounded-md bg-blue-500/20 text-blue-400">
                      <Info className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[13px] text-white/60 leading-snug">
                      <strong className="text-white/95">{combinedLeadPct}% of pipeline</strong> comes from {leadSourceA.name} & {leadSourceB.name}. High ROI on ad spend.
                    </p>
                  </div>
                  
                  {/* Point 2: Funnel Drop */}
                  <div className="flex items-start gap-2.5 group">
                    <div className="mt-0.5 p-1 rounded-md bg-red-500/20 text-red-500">
                      <AlertCircle className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[13px] text-white/60 leading-snug">
                      <strong className="text-white/95">{dropOffRate}% prospect drop-off</strong> approaching the {bottleneckEnd} stage. Review workflow friction.
                    </p>
                  </div>
                  
                  {/* Point 3: Package share */}
                  <div className="flex items-start gap-2.5 group">
                    <div className="mt-0.5 p-1 rounded-md bg-[#C8956C]/20 text-[#C8956C]">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-[13px] text-white/60 leading-snug">
                      <strong className="text-white/95">{topPackage?.revShare ?? 0}% revenue reliance</strong> on {topPackage?.title ?? "your top package"}. Cross-sell opportunities exist.
                    </p>
                  </div>
                </motion.div>
             </AnimatePresence>
          </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
