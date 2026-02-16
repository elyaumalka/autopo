import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addWeeks, subWeeks, isWithinInterval, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, Car, Wrench, DollarSign, CheckSquare, Search, X, Eye, Pencil, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CalendarEvent {
  type: string;
  title: string;
  subtitle: string;
  color: string;
  icon: React.ElementType;
  id?: string;
  raw?: any;
}

type ViewMode = "week" | "month";
type EventType = "rental" | "booking" | "maintenance" | "collection" | "general";

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; colorDot: string }> = {
  rental: { label: "השכרות פעילות", colorDot: "bg-blue-200" },
  booking: { label: "הזמנות", colorDot: "bg-cyan-200" },
  maintenance: { label: "משימות תפעול", colorDot: "bg-orange-200" },
  collection: { label: "גבייה", colorDot: "bg-red-200" },
  general: { label: "משימות כלליות", colorDot: "bg-purple-200" },
};

export default function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(["rental", "booking", "maintenance", "collection", "general"]));

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("status", "פעיל");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .in("status", ["מאושר", "ממתין"]);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: maintenanceTasks = [] } = useQuery({
    queryKey: ["maintenanceTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .neq("status", "הושלם");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: collectionTasks = [] } = useQuery({
    queryKey: ["collectionTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("*")
        .neq("status", "נסגר");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: generalTasks = [] } = useQuery({
    queryKey: ["generalTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_tasks")
        .select("*")
        .neq("status", "הושלם");
      if (error) throw error;
      return data || [];
    }
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = viewMode === "week"
    ? eachDayOfInterval({ start: weekStart, end: weekEnd })
    : eachDayOfInterval({ start: monthStart, end: monthEnd });

  const matchesSearch = (event: CalendarEvent) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return event.title.toLowerCase().includes(term) || event.subtitle.toLowerCase().includes(term);
  };

  const matchesDateRange = (date: Date) => {
    if (dateFrom && date < parseISO(dateFrom)) return false;
    if (dateTo && date > parseISO(dateTo)) return false;
    return true;
  };

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const dateStr = format(date, "yyyy-MM-dd");

    rentals.forEach(rental => {
      if (rental.start_date && rental.planned_end_date) {
        const start = parseISO(rental.start_date);
        const end = parseISO(rental.planned_end_date);
        if (isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end)) {
          events.push({
            type: "rental",
            title: rental.customer_name || "לקוח",
            subtitle: rental.vehicle_details || "",
            color: "bg-blue-100 text-blue-800",
            icon: Car,
            id: rental.id,
            raw: rental,
          });
        }
      }
    });

    bookings.forEach(booking => {
      if (booking.start_date && booking.end_date) {
        const start = parseISO(booking.start_date);
        const end = parseISO(booking.end_date);
        if (isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end)) {
          events.push({
            type: "booking",
            title: booking.customer_name || "לקוח",
            subtitle: `הזמנה - ${booking.vehicle_details || ""}`,
            color: "bg-cyan-100 text-cyan-800",
            icon: Car,
            id: booking.id,
            raw: booking,
          });
        }
      }
    });

    maintenanceTasks.filter(t => t.due_date === dateStr).forEach(task => {
      events.push({
        type: "maintenance",
        title: task.type,
        subtitle: task.vehicle_details || "",
        color: "bg-orange-100 text-orange-800",
        icon: Wrench,
        id: task.id,
        raw: task,
      });
    });

    collectionTasks.filter(t => t.reminder_date === dateStr).forEach(task => {
      events.push({
        type: "collection",
        title: `גבייה - ${task.customer_name || "לקוח"}`,
        subtitle: `₪${task.amount}`,
        color: "bg-red-100 text-red-800",
        icon: DollarSign,
        id: task.id,
        raw: task,
      });
    });

    generalTasks.filter(t => t.due_date === dateStr).forEach(task => {
      events.push({
        type: "general",
        title: task.title,
        subtitle: task.type || "",
        color: "bg-purple-100 text-purple-800",
        icon: CheckSquare,
        id: task.id,
        raw: task,
      });
    });

    return events.filter(e => activeTypes.has(e.type as EventType)).filter(matchesSearch);
  };

  const toggleType = (type: EventType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type); } else { next.add(type); }
      return next;
    });
  };

  // Count all events (unfiltered) for legend badges
  const totalCounts: Record<EventType, number> = { rental: 0, booking: 0, maintenance: 0, collection: 0, general: 0 };
  rentals.forEach(() => totalCounts.rental++);
  bookings.forEach(() => totalCounts.booking++);
  maintenanceTasks.forEach(() => totalCounts.maintenance++);
  collectionTasks.forEach(() => totalCounts.collection++);
  generalTasks.forEach(() => totalCounts.general++);
  const selectedEvents = getEventsForDay(selectedDate);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const navigateToEvent = (event: CalendarEvent) => {
    const id = event.id || "";
    switch (event.type) {
      case "rental":
        navigate(`/rentals?edit=${id}`);
        break;
      case "booking":
        navigate(`/bookings?edit=${id}`);
        break;
      case "maintenance":
        navigate(`/maintenance-tasks?edit=${id}`);
        break;
      case "collection":
        navigate(`/collection-tasks?edit=${id}`);
        break;
      case "general":
        navigate(`/general-tasks?edit=${id}`);
        break;
    }
    setSelectedEvent(null);
  };

  const dayNames = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = searchTerm || dateFrom || dateTo;

  return (
    <div>
      <PageHeader title="לוח שנה" subtitle={viewMode === "week" ? "תצוגה שבועית" : "תצוגה חודשית"} />

      {/* View Mode + Today */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="flex gap-1 border rounded-lg p-0.5">
          <Button
            size="sm"
            variant={viewMode === "week" ? "default" : "ghost"}
            onClick={() => setViewMode("week")}
            className="text-xs h-7"
          >
            שבועי
          </Button>
          <Button
            size="sm"
            variant={viewMode === "month" ? "default" : "ghost"}
            onClick={() => setViewMode("month")}
            className="text-xs h-7"
          >
            חודשי
          </Button>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}>
          <CalendarDays className="w-3 h-3 ml-1" />
          היום
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([type, config]) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeTypes.has(type)
                ? `${config.colorDot} border-border`
                : 'bg-muted/30 border-transparent text-muted-foreground opacity-50'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${config.colorDot}`} />
            {config.label}
            <span className="bg-background/60 rounded-full px-1.5 text-[10px]">{totalCounts[type]}</span>
          </button>
        ))}
      </div>

      {/* Search & Date Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, רכב..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
          <span className="text-muted-foreground text-sm">עד</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 ml-1" />
            נקה
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(viewMode === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold">
              {viewMode === "week"
                ? `${format(weekStart, "d MMM", { locale: he })} - ${format(weekEnd, "d MMM yyyy", { locale: he })}`
                : format(currentDate, "MMMM yyyy", { locale: he })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(viewMode === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day, i) => (
              <div key={i} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {viewMode === "month" && Array(monthStart.getDay()).fill(null).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 bg-muted/50 rounded-lg" />
            ))}
            
            {days.map((day) => {
              const inRange = matchesDateRange(day);
              const events = inRange ? getEventsForDay(day) : [];
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <motion.div
                  key={day.toISOString()}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    h-24 p-1 rounded-lg cursor-pointer border transition-all overflow-hidden
                    ${isSelected ? 'border-accent bg-accent/10' : 'border-transparent hover:border-border'}
                    ${isToday ? 'bg-accent/10' : 'bg-card'}
                    ${!inRange ? 'opacity-40' : ''}
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1 text-center
                    ${isToday ? 'text-accent' : 'text-foreground'}
                  `}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {events.slice(0, 3).map((event, i) => (
                      <div
                        key={i}
                        onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                        className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${event.color}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {events.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{events.length - 3}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {/* Selected Day Details */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4">
            {format(selectedDate, "EEEE, d MMMM", { locale: he })}
          </h3>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              אין אירועים ביום זה
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((event, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleEventClick(event)}
                  className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-shadow ${event.color.replace('text-', 'border-').replace('100', '200')}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${event.color}`}>
                      <event.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{event.subtitle}</p>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">מקרא צבעים</p>
            <div className="space-y-1">
              {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, typeof EVENT_TYPE_CONFIG[EventType]][]).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-2 text-sm w-full text-right transition-opacity ${
                    activeTypes.has(type) ? 'opacity-100' : 'opacity-40 line-through'
                  }`}
                >
                  <div className={`w-3 h-3 rounded ${config.colorDot}`} />
                  <span className="flex-1">{config.label}</span>
                  <span className="text-xs text-muted-foreground">{totalCounts[type]}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && <selectedEvent.icon className="w-5 h-5" />}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${selectedEvent.color}`}>
                <p className="font-medium">{selectedEvent.subtitle}</p>
              </div>

              {/* Event-specific details */}
              {selectedEvent.type === "rental" && selectedEvent.raw && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">תאריך התחלה:</span><span>{selectedEvent.raw.start_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">תאריך סיום מתוכנן:</span><span>{selectedEvent.raw.planned_end_date || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">עלות:</span><span>₪{selectedEvent.raw.total_cost?.toLocaleString() || selectedEvent.raw.base_cost?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">שולם:</span><span className="text-green-600">₪{selectedEvent.raw.paid_amount?.toLocaleString() || 0}</span></div>
                </div>
              )}

              {selectedEvent.type === "booking" && selectedEvent.raw && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">תאריך התחלה:</span><span>{selectedEvent.raw.start_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">תאריך סיום:</span><span>{selectedEvent.raw.end_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">סטטוס:</span><span>{selectedEvent.raw.status}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">עלות:</span><span>₪{selectedEvent.raw.rental_cost?.toLocaleString() || 0}</span></div>
                </div>
              )}

              {selectedEvent.type === "maintenance" && selectedEvent.raw && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">סוג:</span><span>{selectedEvent.raw.type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">סטטוס:</span><span>{selectedEvent.raw.status}</span></div>
                  {selectedEvent.raw.cost && <div className="flex justify-between"><span className="text-muted-foreground">עלות:</span><span>₪{selectedEvent.raw.cost?.toLocaleString()}</span></div>}
                </div>
              )}

              {selectedEvent.type === "collection" && selectedEvent.raw && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">סכום:</span><span className="text-red-600 font-bold">₪{selectedEvent.raw.amount?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">סטטוס:</span><span>{selectedEvent.raw.status}</span></div>
                  {selectedEvent.raw.reason && <div className="flex justify-between"><span className="text-muted-foreground">סיבה:</span><span>{selectedEvent.raw.reason}</span></div>}
                </div>
              )}

              <Button onClick={() => navigateToEvent(selectedEvent)} className="w-full">
                <Pencil className="w-4 h-4 ml-2" />
                עבור לעריכה
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
