import React, { useState } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isSameDay 
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '@/data/mockData';
import { istDayKey, formatISTTime } from '@/lib/datetime';
import { Button } from '@/components/ui/button';

interface CalendarViewProps {
  bookings: Booking[];
  onBookingClick: (b: Booking) => void;
}

const getTypeClasses = (type: Booking['eventType']) => {
  switch (type) {
    case "Wedding": return "bg-primary/20 text-primary border-primary/30";
    case "Pre-Wedding": return "bg-pink-500/20 text-pink-500 border-pink-500/30";
    case "Corporate": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
    case "Portrait": return "bg-purple-500/20 text-purple-500 border-purple-500/30";
    default: return "bg-slate-500/20 text-slate-500 border-slate-500/30";
  }
};

export function CalendarView({ bookings, onBookingClick }: CalendarViewProps) {
  // Let's set initial view to April 2025 since mock data centers around there
  const [currentDate, setCurrentDate] = useState(new Date(2025, 3, 1)); // Month is 0-indexed, so 3 = April

  // Pre-group bookings by date for O(1) lookup performance
  const bookingsByDate = React.useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(b => {
      // Group by the IST calendar day so shoots land on the Indian date.
      const dateKey = istDayKey(b.date);
      if (!dateKey) return;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(b);
    });
    return map;
  }, [bookings]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "MMMM yyyy";
  const daysInCalendar = eachDayOfInterval({ start: startDate, end: endDate });

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex flex-col h-full min-h-[700px] w-full p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {format(currentDate, dateFormat)}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-lg border-border/50 bg-card/50">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 rounded-lg border-border/50 bg-card/50">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-lg border-border/50 bg-card/50">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 rounded-xl border border-border/50 bg-muted/10 overflow-hidden flex flex-col">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/20">
          {WEEKDAYS.map(day => (
            <div key={day} className="py-3 text-center text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {daysInCalendar.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[120px] p-2 border-r border-b border-border/30 flex flex-col gap-1 transition-colors
                  ${!isCurrentMonth ? 'bg-muted/5' : 'hover:bg-muted/10'}
                  ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                `}
              >
                {/* Date Number */}
                <div className="flex justify-end mb-1">
                  <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[12px] font-semibold
                    ${isTodayDate ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Event Pills */}
                <div className="flex flex-col gap-1 flex-1 overflow-y-auto hide-scrollbar">
                  {dayBookings.slice(0, 3).map(b => (
                    <div 
                      key={b.id} 
                      onClick={() => onBookingClick(b)}
                      className={`truncate text-[10px] font-bold px-1.5 py-1 rounded cursor-pointer border hover:opacity-80 transition-opacity ${getTypeClasses(b.eventType)}`}
                      title={b.clientName}
                    >
                      {formatISTTime(b.date, { hour12: false })} {b.clientName}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-[10px] font-bold text-muted-foreground text-center mt-0.5">
                      + {dayBookings.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
