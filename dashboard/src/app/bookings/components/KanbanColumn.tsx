import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface KanbanColumnProps {
  id: string;
  title: string;
  isHighlighted?: boolean;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, isHighlighted, children }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  const getStyle = () => {
    switch(id) {
      case "Pending":
        return isHighlighted ? 'bg-amber-500/10 border-amber-500/50' : 'bg-amber-500/5 border-amber-500/20';
      case "Confirmed":
        return isHighlighted ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-emerald-500/5 border-emerald-500/20';
      case "Completed":
        return isHighlighted ? 'bg-slate-500/10 border-slate-500/50' : 'bg-slate-500/5 border-slate-500/20';
      case "Cancelled":
        return isHighlighted ? 'bg-red-500/10 border-red-500/50' : 'bg-red-500/5 border-red-500/20';
      default:
        return isHighlighted ? 'bg-primary/10 border-primary/50' : 'bg-muted/20 border-border/20';
    }
  }

  return (
    <div 
      ref={setNodeRef} 
      className={`flex flex-col w-[320px] min-w-[320px] rounded-xl p-3 border transition-colors ${getStyle()}`}
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <h3 className="font-bold text-[14px] text-foreground tracking-wide">{title}</h3>
        <span className="text-[12px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {React.Children.count(children)}
        </span>
      </div>
      <div className="flex flex-col gap-3 min-h-[150px]">
        {children}
      </div>
    </div>
  );
}
