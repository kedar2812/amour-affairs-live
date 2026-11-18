import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Booking } from '@/data/mockData';
import { formatISTDate } from '@/lib/datetime';

interface KanbanCardProps {
  booking: Booking;
  isOverlay?: boolean;
  onClick?: () => void;
}

const getTypeClasses = (type: Booking['eventType']) => {
  switch (type) {
    case "Wedding": return "bg-primary/10 text-primary border-primary/20";
    case "Pre-Wedding": return "bg-pink-500/10 text-pink-500 border-pink-500/20";
    case "Corporate": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Portrait": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
};

export function KanbanCard({ booking, isOverlay, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: booking.id, data: booking });

  const style = isOverlay ? {} : {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isDragging && !isOverlay) {
    return <div ref={setNodeRef} style={style} className="bg-card/50 border border-border/50 rounded-xl h-[120px] opacity-40 shadow-inner" />;
  }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={onClick}
      className={`dash-card p-4 select-none ${isOverlay ? 'shadow-2xl cursor-grabbing z-50 ring-2 ring-primary/20 w-[296px]' : 'cursor-grab active:cursor-grabbing hover:bg-muted/30 transition-colors'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7 text-[10px]">
             <AvatarFallback className="bg-primary/20 text-primary">{booking.clientName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-[13px] text-foreground truncate max-w-[150px]">{booking.clientName}</span>
        </div>
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${getTypeClasses(booking.eventType)}`}>
          {booking.eventType}
        </span>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <span className="text-[12px] font-medium text-muted-foreground">{formatISTDate(booking.date, { month: 'short', day: 'numeric' })}</span>
        <span className="text-[13px] font-bold text-foreground">₹{booking.amount.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
