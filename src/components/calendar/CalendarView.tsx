import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, Car, Wrench, DollarSign, CheckSquare, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface CalendarEvent {
  type: string;
  title: string;
  subtitle: string;
  color: string;
  icon: LucideIcon;
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (date: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const dateStr = format(date, "yyyy-MM-dd");

    // Rentals (check if date is within rental period)
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
            icon: Car
          });
        }
      }
    });

    // Bookings
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
            icon: Car
          });
        }
      }
    });

    // Maintenance tasks
    maintenanceTasks.filter(t => t.due_date === dateStr).forEach(task => {
      events.push({
        type: "maintenance",
        title: task.type,
        subtitle: task.vehicle_details || "",
        color: "bg-orange-100 text-orange-800",
        icon: Wrench
      });
    });

    // Collection tasks
    collectionTasks.filter(t => t.reminder_date === dateStr).forEach(task => {
      events.push({
        type: "collection",
        title: `גבייה - ${task.customer_name || "לקוח"}`,
        subtitle: `₪${task.amount}`,
        color: "bg-red-100 text-red-800",
        icon: DollarSign
      });
    });

    // General tasks
    generalTasks.filter(t => t.due_date === dateStr).forEach(task => {
      events.push({
        type: "general",
        title: task.title,
        subtitle: task.type || "",
        color: "bg-purple-100 text-purple-800",
        icon: CheckSquare
      });
    });

    return events;
  };

  const selectedEvents = getEventsForDay(selectedDate);

  const dayNames = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  return (
    <div>
      <PageHeader title="לוח שנה" subtitle="תצוגה חודשית" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold">
              {format(currentDate, "MMMM yyyy", { locale: he })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
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
            {/* Empty cells for days before month starts */}
            {Array(monthStart.getDay()).fill(null).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 bg-muted/50 rounded-lg" />
            ))}
            
            {days.map((day) => {
              const events = getEventsForDay(day);
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
                        className={`text-xs px-1 py-0.5 rounded truncate ${event.color}`}
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
                  className={`p-3 rounded-xl border ${event.color.replace('text-', 'border-').replace('100', '200')}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${event.color}`}>
                      <event.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">מקרא צבעים</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-blue-100" />
                <span>השכרות פעילות</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-cyan-100" />
                <span>הזמנות</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-orange-100" />
                <span>משימות תפעול</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-red-100" />
                <span>גבייה</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded bg-purple-100" />
                <span>משימות כלליות</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
