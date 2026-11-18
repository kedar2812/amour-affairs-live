"use client";
import { motion } from "framer-motion";
import { Clock, ChevronRight, CheckCircle2, type LucideIcon } from "lucide-react";

/*
 * Donezo "Reminders" widget adapted as priority action items.
 */
type ActionItem = { title: string; desc: string; time: string; icon: LucideIcon; color: string; bg: string; border: string; action: string };

// Not yet wired to live data — intentionally empty until real reminders exist.
const actions: ActionItem[] = [];

export function PendingActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.36 }}
      className="h-full"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="dash-card-title">Action Items</h3>
            <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{actions.length}</span>
          </div>
          <button className="text-[13px] font-semibold text-primary flex items-center gap-0.5 hover:underline">
            View All <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 px-5 pb-5 space-y-2.5">
          {actions.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">No pending actions</p>
            </div>
          )}
          {actions.map((action, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.06 }}
              className={`flex gap-3 p-3.5 rounded-xl border ${action.border} dark:border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer group`}
            >
              <div className={`shrink-0 h-9 w-9 flex items-center justify-center rounded-lg ${action.bg} dark:bg-opacity-10 ${action.color}`}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-[14px] font-semibold text-foreground truncate">{action.title}</h5>
                <p className="text-[12px] text-muted-foreground truncate">{action.desc}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground font-medium">{action.time}</span>
                </div>
              </div>
              <button className={`shrink-0 self-center text-[12px] font-bold ${action.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                {action.action} →
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
