"use client";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { usePackages, useBookings } from "@/lib/useData";
import { formatINRCompact } from "@/lib/utils";
import type { Package, Booking } from "@/data/mockData";

/*
 * Package Performance — live from packages + bookings.
 * Ranks packages by realised revenue (sum of booking amounts) and shows
 * each one's share of total booked revenue.
 */

const PALETTE = ["var(--primary)", "#ec4899", "#3b82f6", "#a855f7", "#10b981", "#f59e0b"];

export function PackagePerformance() {
  const { data: packages } = usePackages();
  const { data: bookings } = useBookings();

  const pkgList = (packages as Package[]) || [];
  const bookingList = (bookings as Booking[]) || [];

  // Aggregate revenue + count per package (matched by id or name).
  const rows = pkgList
    .map((pkg, i) => {
      const matched = bookingList.filter(
        (b) => b.packageId === pkg.id || (b.packageName && b.packageName === pkg.name)
      );
      const revenue = matched.reduce((s, b) => s + (b.amount || 0), 0);
      return { title: pkg.name, bookings: matched.length, revenue, color: PALETTE[i % PALETTE.length] };
    })
    .filter((r) => r.bookings > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.28 }}
      className="h-full relative"
    >
      <div className="dash-card h-full flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h3 className="dash-card-title">Package Performance</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">Top packages by revenue</p>
          </div>
        </div>

        <div className="flex-1 px-6 pb-5 space-y-4">
          {rows.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">No package bookings yet</p>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {rows.map((pkg) => {
              const revShare = Math.round((pkg.revenue / totalRevenue) * 100);
              return (
                <motion.div
                  key={pkg.title}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                    style={{ background: pkg.color }}
                  >
                    {pkg.title.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-[13px] font-semibold text-foreground truncate">{pkg.title}</h5>
                      <span className="text-[13px] font-bold text-foreground ml-2">{formatINRCompact(pkg.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${revShare}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ background: pkg.color }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium w-8 text-right">{revShare}%</span>
                      <span className="text-[11px] text-muted-foreground w-14 text-right">
                        {pkg.bookings} {pkg.bookings === 1 ? "booking" : "bookings"}
                      </span>
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
