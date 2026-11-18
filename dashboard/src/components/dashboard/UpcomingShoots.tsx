"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Clock, ChevronRight, CalendarDays } from "lucide-react";
import { useBookings } from "@/lib/useData";
import type { Booking } from "@/data/mockData";
import { parseIST, istTime, formatISTDate, formatISTTime, istDayOfMonth } from "@/lib/datetime";

/*
 * Upcoming Shoots — live from bookings. Shows the next 7 days of
 * confirmed/pending shoots with date block, category badge and venue.
 */
const categoryStyles: Record<string, { bg: string; text: string }> = {
  Wedding: { bg: "bg-primary/10", text: "text-primary" },
  "Pre-Wedding": { bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  Corporate: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  Portrait: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
};
const defaultStyle = { bg: "bg-muted", text: "text-muted-foreground" };

export function UpcomingShoots() {
  const { data: bookings } = useBookings();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const shoots = ((bookings as Booking[]) || [])
    .filter((b) => {
      if (b.status === "Cancelled" || b.status === "Completed") return false;
      const d = parseIST(b.date);
      return !!d && d >= now && d <= in7Days;
    })
    .sort((a, b) => istTime(a.date) - istTime(b.date))
    .slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="h-full"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="dash-card-title">Upcoming Shoots</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Next 7 days</p>
          </div>
          <Link href="/bookings" className="text-[13px] font-semibold text-primary flex items-center gap-0.5 hover:underline">
            View All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
          {shoots.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">No shoots in the next 7 days</p>
            </div>
          )}
          {shoots.map((shoot, i) => {
            const style = categoryStyles[shoot.eventType] || defaultStyle;
            const weekday = formatISTDate(shoot.date, { weekday: "short" });
            const day = istDayOfMonth(shoot.date);
            const time = formatISTTime(shoot.date);
            return (
              <motion.div
                key={shoot.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.25 + i * 0.06 }}
                className="flex gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="w-11 shrink-0 flex flex-col items-center justify-center py-1.5 bg-muted rounded-lg">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{weekday}</span>
                  <span className="text-lg font-bold text-foreground leading-tight">{day}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-[14px] font-semibold text-foreground truncate">{shoot.clientName}</h4>
                    <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                      {shoot.eventType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{shoot.venue}{shoot.city ? `, ${shoot.city}` : ""}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
