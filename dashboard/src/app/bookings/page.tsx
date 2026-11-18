"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Calendar as CalendarIcon, List as ListIcon, LayoutDashboard, MapPin, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/Drawer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { flattenBookings } from '@/lib/exportUtils';
import { useBookings, useTeam } from '@/lib/useData';
import { bookingsAPI, getStoredToken } from '@/lib/api';
import { useToast } from '@/lib/ToastContext';
import type { WithDbId } from '@/lib/normalize';
import { Booking } from '@/data/mockData';
import { formatISTDate, formatISTTime, istDayOfMonth } from '@/lib/datetime';
import { KanbanView } from './components/KanbanView';
import { CalendarView } from './components/CalendarView';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

const isMockMode = () => {
  const token = getStoredToken();
  return !token || token.startsWith("mock_");
};

// Badges Helper
const getStatusClasses = (status: Booking['status']) => {
  switch (status) {
    case "Confirmed": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "Pending": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "Completed": return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    case "Cancelled": return "bg-red-500/10 text-red-500 border-red-500/20";
    default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
};

const getTypeClasses = (type: Booking['eventType']) => {
  switch (type) {
    case "Wedding": return "bg-primary/10 text-primary border-primary/20";
    case "Pre-Wedding": return "bg-pink-500/10 text-pink-500 border-pink-500/20";
    case "Corporate": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Portrait": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
};

// Status Dropdown Wrapper
function StatusDropdown({ currentStatus, onStatusChange }: { currentStatus: Booking['status'], onStatusChange: (status: Booking['status']) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const statuses: Booking['status'][] = ["Pending", "Confirmed", "Completed", "Cancelled"];

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <LiquidButton 
        size="sm" 
        onClick={() => setIsOpen(!isOpen)}
        className={`h-7 px-4 text-[11px] font-bold tracking-wider rounded-full ${getStatusClasses(currentStatus)}`}
      >
        {currentStatus}
      </LiquidButton>
      
      {isOpen && (
        <div className="absolute top-10 -left-4 z-50 w-36 p-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Liquid Glass Background Layers */}
          <div className="pointer-events-none absolute top-0 left-0 z-0 h-full w-full rounded-xl 
            shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.15)] 
            transition-all 
            dark:shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3.5px_rgba(255,255,255,0.09),inset_-3px_-3px_0.5px_-3.5px_rgba(255,255,255,0.85),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.6),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.6),inset_0_0_6px_6px_rgba(255,255,255,0.12),inset_0_0_2px_2px_rgba(255,255,255,0.06),0_0_12px_rgba(0,0,0,0.15)]" />
          <div
            className="pointer-events-none absolute top-0 left-0 isolate -z-10 h-full w-full overflow-hidden rounded-xl bg-background/60"
            style={{ backdropFilter: 'blur(12px) url("#container-glass")' }}
          />

          {/* Menu Items */}
          <div className="relative z-10 flex flex-col gap-1 w-full">
            {statuses.map(status => (
              <button 
                key={status} 
                onClick={() => { onStatusChange(status); setIsOpen(false); }}
                className={`text-left px-3 py-2 text-xs font-semibold rounded-lg transition-all ${status === currentStatus ? 'bg-muted/60 shadow-sm ' + getStatusClasses(status) : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<"List" | "Calendar" | "Kanban">("List");
  const { data: bookingsData, isLoading } = useBookings();
  const { data: teamMembers } = useTeam(true);
  const { showToast } = useToast();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Sync from hook
  React.useEffect(() => { setAllBookings(bookingsData); }, [bookingsData]);

  // Global search deep link: /bookings/?q=priya pre-fills the search box
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  React.useEffect(() => {
    const handleSync = (e: any) => {
      const { newBooking, isEdit } = e.detail;
      if (isEdit) {
        setAllBookings(prev => prev.map(b => b.id === newBooking.id ? newBooking : b));
      } else {
        setAllBookings(prev => [newBooking, ...prev]);
      }
      setSelectedBooking(newBooking);
    };
    window.addEventListener('booking-synced', handleSync);
    return () => window.removeEventListener('booking-synced', handleSync);
  }, []);

  const filteredBookings = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allBookings.filter(b => 
      b.clientName.toLowerCase().includes(query) || 
      b.id.toLowerCase().includes(query)
    );
  }, [allBookings, searchQuery]);

  // Optimistically update, persist through the API, roll back on failure.
  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    const target = allBookings.find(b => b.id === bookingId) as WithDbId<Booking> | undefined;
    if (!target) return;
    const prevStatus = target.status;
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    setSelectedBooking(s => s && s.id === bookingId ? { ...s, status: newStatus } : s);
    if (isMockMode() || !target.dbId) return; // demo data — local only
    try {
      await bookingsAPI.update(target.dbId, { status: newStatus });
    } catch (err) {
      setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: prevStatus } : b));
      showToast(err instanceof Error ? err.message : "Couldn't update the booking status — please try again.", "error");
    }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    if (!window.confirm(`Delete booking ${booking.id} for ${booking.clientName}? This cannot be undone.`)) return;
    const dbId = (booking as WithDbId<Booking>).dbId;
    try {
      if (!isMockMode() && dbId) await bookingsAPI.delete(dbId);
      setAllBookings(prev => prev.filter(b => b.id !== booking.id));
      setSelectedBooking(null);
      showToast(`Booking ${booking.id} deleted.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the booking — please try again.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="dash-h1">Bookings</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Manage all your studio shoots and appointments.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search bookings..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-[240px] pl-9 pr-4 bg-card border border-border/50 rounded-xl text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <ExportMenu
            datasets={[flattenBookings(filteredBookings)]}
            filename="amour-affairs-bookings"
            pdfTitle="Bookings Export"
            variant="inline"
          />
          <Button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-add-booking'))}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground border-none shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Booking
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card/50 border border-border/50 p-1 rounded-xl w-max">
        {(["List", "Calendar", "Kanban"] as const).map(tab => {
          const Icon = tab === "List" ? ListIcon : tab === "Calendar" ? CalendarIcon : LayoutDashboard;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab Content Areas */}
      <div className="flex-1 w-full relative">
        <AnimatePresence mode="popLayout">
          {activeTab === "List" && (
            <motion.div 
              key="List"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full p-6 flex flex-col"
            >
              <div className="dash-card overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 text-[12px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-4 font-semibold">Booking ID</th>
                      <th className="px-6 py-4 font-semibold">Client</th>
                      <th className="px-6 py-4 font-semibold">Event Type</th>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Venue</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr 
                    key={b.id} 
                    onClick={() => setSelectedBooking(b)}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-mono text-[13px] text-muted-foreground">{b.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-2 ring-background">
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold text-xs text-center border border-primary/20">{b.clientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-[14px] text-foreground">{b.clientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getTypeClasses(b.eventType)}`}>
                        {b.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-foreground">
                      {formatISTDate(b.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      <span className="text-muted-foreground ml-1">· {formatISTTime(b.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-[13px]">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate max-w-[140px]">{b.venue}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-[14px] text-foreground">
                      ₹{b.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      <StatusDropdown 
                        currentStatus={b.status} 
                        onStatusChange={(newStatus) => handleUpdateBookingStatus(b.id, newStatus)} 
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost" size="icon" title="Delete booking"
                        onClick={(e) => { e.stopPropagation(); handleDeleteBooking(b); }}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {isLoading && filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <Loader2 className="h-6 w-6 text-primary animate-spin inline-block" />
                    </td>
                  </tr>
                )}
                {!isLoading && filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-[14px] font-semibold text-foreground">
                        {searchQuery ? `No bookings match "${searchQuery}"` : "No bookings yet"}
                      </p>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {searchQuery ? "Try a different client name or booking ID." : "Click “Add Booking” to create your first booking."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {activeTab === "Calendar" && (
          <motion.div 
            key="Calendar"
             initial={{ opacity: 0, scale: 0.99, y: 5 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.99, y: 5 }}
             transition={{ duration: 0.2, ease: "easeOut" }}
             className="w-full flex"
          >
            <CalendarView bookings={filteredBookings} onBookingClick={setSelectedBooking} />
          </motion.div>
        )}

        {activeTab === "Kanban" && (
          <motion.div 
            key="Kanban"
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0, scale: 0.98 }}
             transition={{ duration: 0.2, ease: "easeOut" }}
             className="w-full flex"
          >
            <KanbanView bookings={filteredBookings} onBookingClick={setSelectedBooking} onStatusChange={handleUpdateBookingStatus} />
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Detail Drawer */}
      <Drawer
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        width="480px"
      >
        {selectedBooking && (
          <div className="p-0">
            {/* Drawer Header Block */}
            <div className="p-8 pb-6 border-b border-border/50 bg-muted/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <CalendarIcon className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16 ring-4 ring-background shadow-xl">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">{selectedBooking.clientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{selectedBooking.clientName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-sm text-muted-foreground">{selectedBooking.id}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getTypeClasses(selectedBooking.eventType)}`}>
                        {selectedBooking.eventType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Layout Box */}
            <div className="p-8 space-y-8">
              {/* Timing */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Event Schedule</h4>
                <div className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                  <div className="h-10 w-10 flex flex-col items-center justify-center bg-primary/10 rounded-lg text-primary shrink-0">
                    <span className="text-[10px] font-semibold uppercase leading-none">{formatISTDate(selectedBooking.date, { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none mt-0.5">{istDayOfMonth(selectedBooking.date)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[15px] text-foreground">{formatISTDate(selectedBooking.date, { weekday: 'long', year: 'numeric' })}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {formatISTTime(selectedBooking.date)} &nbsp;—&nbsp; {formatISTTime(selectedBooking.endDate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Venue */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Venue</h4>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                  <div className="h-10 w-10 flex items-center justify-center bg-muted rounded-lg shrink-0">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-[15px] text-foreground">{selectedBooking.venue}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{selectedBooking.city}</p>
                  </div>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Team Assigned</h4>
                <div className="flex flex-col gap-2">
                  {selectedBooking.teamAssignedIds.map(id => {
                    const member = teamMembers.find(t => t.id === id);
                    if (!member) return null;
                    return (
                      <div key={id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">{member.avatarInitials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[14px] font-semibold text-foreground leading-tight">{member.name}</p>
                          <p className="text-[12px] text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Actions */}
            <div className="sticky bottom-0 p-6 bg-card border-t border-border/50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Amount</p>
                <p className="text-xl text-foreground font-bold leading-tight">₹{selectedBooking.amount.toLocaleString('en-IN')}</p>
              </div>
              <Button
                variant="ghost" size="icon" title="Delete booking"
                onClick={() => handleDeleteBooking(selectedBooking)}
                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('open-add-booking', { detail: { bookingToEdit: selectedBooking } }))}
                className="rounded-xl px-6 bg-[#c9a96e] text-black hover:bg-[#d6b981] font-semibold shadow-md border-none"
              >
                Edit Booking
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
