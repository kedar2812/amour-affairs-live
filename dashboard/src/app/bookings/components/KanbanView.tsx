import React, { useState, useEffect } from 'react';
import {
  DndContext,  
  pointerWithin, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { snapCenterToCursor, restrictToWindowEdges } from '@dnd-kit/modifiers';
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { Booking } from '@/data/mockData';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

const COLUMNS = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;

interface KanbanViewProps {
  bookings: Booking[];
  onBookingClick: (b: Booking) => void;
  onStatusChange: (id: string, newStatus: Booking['status']) => void;
}

export function KanbanView({ bookings: initialBookings, onBookingClick, onStatusChange }: KanbanViewProps) {
  const [items, setItems] = useState(initialBookings);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Sync internal layout with global source of truth when external filters/changes happen
  useEffect(() => {
    setItems(initialBookings);
  }, [initialBookings]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) {
      setOverId(null);
      return;
    }
    
    setOverId(over.id);

    const activeId = active.id;
    const overId = over.id;

    // Is the item being dropped over a column?
    const isOverAColumn = COLUMNS.includes(overId);
    
    if (isOverAColumn) {
      setItems((prev) => {
        const activeIndex = prev.findIndex(b => b.id === activeId);
        if (activeIndex === -1) return prev;
        
        const newItems = [...prev];
        newItems[activeIndex] = { ...newItems[activeIndex], status: overId as Booking['status'] };
        return newItems;
      });
      return;
    }

    // Is it dropping over another item?
    const activeIndex = items.findIndex(b => b.id === activeId);
    const overIndex = items.findIndex(b => b.id === overId);

    if (activeIndex !== -1 && overIndex !== -1 && items[activeIndex].status !== items[overIndex].status) {
      setItems((prev) => {
        const newItems = [...prev];
        newItems[activeIndex] = { ...newItems[activeIndex], status: newItems[overIndex].status };
        return arrayMove(newItems, activeIndex, overIndex);
      });
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIndex = items.findIndex(b => b.id === active.id);
    const overIndex = items.findIndex(b => b.id === over.id);
    
    // Find item's exact current status after the drop resolution
    // Note: If over a column, activeIndex's status was already updated in onDragOver visual state
    // We just read the final state of activeItem from `items` and sync it globally.
    const droppedItemStatus = items[activeIndex]?.status;

    if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
      setItems((prev) => arrayMove(prev, activeIndex, overIndex));
    }

    if (droppedItemStatus) {
      // Look at what parent thinks the status is
      const parentItem = initialBookings.find(b => b.id === active.id);
      if (parentItem && parentItem.status !== droppedItemStatus) {
        onStatusChange(active.id, droppedItemStatus);
      }
    }
  };

  const activeItem = items.find(b => b.id === activeId);
  const highlightedColumn = overId 
    ? (COLUMNS.includes(overId as any) ? overId : items.find(b => b.id === overId)?.status) 
    : null;

  // Memoize grouped items to avoid redundant filtering in the render loop
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    COLUMNS.forEach(col => groups[col] = []);
    items.forEach(item => {
      if (groups[item.status]) groups[item.status].push(item);
    });
    return groups;
  }, [items]);

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4 h-full min-h-[600px] p-6">
        {COLUMNS.map(columnId => {
          const columnBookings = groupedItems[columnId] || [];
          return (
            <KanbanColumn key={columnId} id={columnId} title={columnId} isHighlighted={highlightedColumn === columnId}>
              <SortableContext 
                items={columnBookings.map(b => b.id)} 
                strategy={verticalListSortingStrategy}
              >
                {columnBookings.map(b => (
                  <KanbanCard key={b.id} booking={b} onClick={() => onBookingClick(b)} />
                ))}
              </SortableContext>
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay modifiers={[snapCenterToCursor, restrictToWindowEdges]}>
        {activeItem ? <KanbanCard booking={activeItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
