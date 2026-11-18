"use client";
import { motion } from "framer-motion";
import { CalendarCheck, IndianRupee, BookOpen, Eye } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { useBookingStats, useLeads } from "@/lib/useData";

/*
 * KPI strip — live from the API (bookings stats + leads). Shows real figures
 * (0 until there's data) instead of fabricated demo numbers.
 */
import { formatINRCompact as fmtMoney } from "@/lib/utils";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
  hover: { y: -4, scale: 1.015, boxShadow: "0 12px 24px -10px rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,0,0,0.03)" },
};
const iconVariants = { hover: { rotate: 12, scale: 1.08, transition: { type: "spring" as const, stiffness: 300, damping: 15 } } };

export function KPICards() {
  const { data: stats } = useBookingStats();
  const { data: leads } = useLeads();

  const s = (stats || {}) as Record<string, number>;
  // A lead is "active" until it's won or lost (or otherwise closed/delivered).
  const closedStages = ["won", "booked", "lost", "delivered", "closed", "completed"];
  const activeInquiries = (leads as Array<{ stage?: string }> || []).filter(
    (l) => !closedStages.includes((l.stage || "").toLowerCase())
  ).length;

  const metrics = [
    {
      title: "Total Bookings", value: String(s.total_bookings ?? 0),
      label: `${s.confirmed ?? 0} confirmed · ${s.pending ?? 0} pending`,
      icon: BookOpen, iconBg: "bg-primary/10", iconColor: "text-primary", borderColor: "border-l-primary",
    },
    {
      title: "Gross Revenue", value: fmtMoney(s.total_revenue),
      label: `${fmtMoney(s.collected)} collected`,
      icon: IndianRupee, iconBg: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-500", borderColor: "border-l-emerald-500",
    },
    {
      title: "Active Inquiries", value: String(activeInquiries),
      label: "Open leads in the pipeline",
      icon: Eye, iconBg: "bg-blue-50 dark:bg-blue-500/10", iconColor: "text-blue-600 dark:text-blue-500", borderColor: "border-l-blue-500",
    },
    {
      title: "Upcoming Shoots", value: String(s.upcoming_30_days ?? 0),
      label: "Confirmed in next 30 days",
      icon: CalendarCheck, iconBg: "bg-amber-50 dark:bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-500", borderColor: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.title}
          custom={index}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          whileHover="hover"
          whileTap={{ scale: 0.995 }}
          className="cursor-pointer"
        >
          <div className={`dash-card p-5 flex items-start gap-4 border-l-4 ${metric.borderColor} h-full`}>
            <motion.div variants={iconVariants} className={`h-12 w-12 rounded-xl ${metric.iconBg} flex items-center justify-center shrink-0`}>
              <metric.icon className={`h-6 w-6 ${metric.iconColor}`} strokeWidth={1.7} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <p className="text-[14px] font-bold text-foreground">{metric.title}</p>
              </div>
              <h3 className="text-2xl font-bold text-foreground mt-1 tracking-tight">
                <AnimatedCounter value={metric.value} />
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[12px] font-medium text-muted-foreground">{metric.label}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
