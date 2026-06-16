import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronRight, 
  ChevronLeft, 
  ZoomIn, 
  ZoomOut, 
  Plus,
  Wrench
} from "lucide-react";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  parseISO,
  isWithinInterval,
  differenceInDays,
  startOfMonth,
  endOfMonth
} from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Rental = Database["public"]["Tables"]["rentals"]["Row"];
type MaintenanceTask = Database["public"]["Tables"]["maintenance_tasks"]["Row"];

interface BookingsCalendarViewProps {
  onNewBooking?: () => void;
  onCellClick?: (date: Date, vehicle: Vehicle, booking?: any, slotInfo?: { slot: "am" | "pm"; existingEndTime?: string | null }) => void;
  onMaintenanceClick?: (vehicle: Vehicle, date?: string) => void;
  maintenanceTasks?: MaintenanceTask[];
}

export default function BookingsCalendarView({ onNewBooking, onCellClick, onMaintenanceClick, maintenanceTasks = [] }: BookingsCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month" | "unlimited">("week");
  const [hideMonthly, setHideMonthly] = useState(false);
  const [hideWeekly, setHideWeekly] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const queryClient = useQueryClient();

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));

  // Realtime: עדכון אוטומטי של הלוח בעת שינויים בהזמנות/השכרות/טיפולים
  useEffect(() => {
    const channel = supabase
      .channel("bookings-calendar-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["vehicles-all"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getDateRange = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 7 };
    } else if (viewMode === "month") {
      // החודש הנוכחי מה-1 ועד סוף החודש (לא 30 הימים הבאים)
      const start = startOfMonth(currentDate);
      const days = differenceInDays(endOfMonth(currentDate), start) + 1;
      return { start, days };
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 60 };
    }
  };

  const { start: weekStart, days: visibleDays } = getDateRange();
  const weekEnd = addDays(weekStart, visibleDays - 1);
  const weekDays = Array.from({ length: visibleDays }, (_, i) => addDays(weekStart, i)).reverse();

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-all", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      // Get active vehicles + sold vehicles that were sold after the calendar start
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("license_plate");
      if (error) throw error;
      const startStr = format(weekStart, "yyyy-MM-dd");
      return (data || []).filter(v => {
        if (v.status !== "נמכר") return true;
        // Show sold vehicles only if sold_date is after the calendar start
        const soldDate = (v as any).sold_date;
        return soldDate && soldDate >= startStr;
      });
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings-week", weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .gte("end_date", format(weekStart, "yyyy-MM-dd"))
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .in("status", ["פעיל", "הושלם"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const matchVehicleToDetails = (vehicleLicensePlate: string, details: string | null) => {
    if (!details) return false;
    return details.includes(vehicleLicensePlate);
  };

  const getRentalType = (billingRateType: string | null, startDate: string, endDate: string | null): "daily" | "weekly" | "monthly" => {
    // Use billing_rate_type if set
    if (billingRateType === "חודשי") return "monthly";
    if (billingRateType === "שבועי") return "weekly";
    if (billingRateType === "יומי") return "daily";
    // Fallback to duration-based calculation
    if (!endDate) return "monthly";
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = differenceInDays(end, start);
    if (days >= 25) return "monthly";
    if (days >= 6) return "weekly";
    return "daily";
  };

  const parseHour = (time: string | null | undefined): number | null => {
    if (!time) return null;
    const parts = time.split(":");
    const h = parseInt(parts[0]);
    const m = parts.length > 1 ? parseInt(parts[1]) : 0;
    if (isNaN(h)) return null;
    // החזר ערך עשרוני כדי לתפוס נכון שעות עם דקות (10:59 ≈ 10.98 ולא 10)
    return h + (isNaN(m) ? 0 : m / 60);
  };

  type SlotEvent = {
    type: "rental" | "booking";
    id?: string;
    customerName: string;
    status: string;
    rentalType: "daily" | "weekly" | "monthly";
    endTime?: string | null;
    startTime?: string | null;
    /** Position within slot: 0 = right edge (slot start in RTL), 1 = left edge (slot end) */
    startFrac: number;
    endFrac: number;
    timeLabel?: string | null;
  };
  type SlotResult = {
    status: "full" | "partial" | "free" | "multi";
    partialSide?: "start" | "end";
    timeLabel?: string | null;
    event?: Omit<SlotEvent, "startFrac" | "endFrac">;
    events?: SlotEvent[];
  };

  const getSlotStatus = (vehicle: Vehicle, day: Date, slot: "am" | "pm"): SlotResult => {
    // Check active rentals first
    const matchingRentals = rentals.filter(r => {
      const matchById = r.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, r.vehicle_details);
      if (!matchById && !matchByDetails) return false;
      const start = parseISO(r.start_date);
      const effectiveEndDate = r.actual_end_date || r.planned_end_date;
      const end = effectiveEndDate ? parseISO(effectiveEndDate) : addDays(start, 30);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    const candidates: { result: SlotResult; overlapMs: number; eventForMulti: SlotEvent | null }[] = [];
    const { slotStart, slotEnd } = getSlotBounds(day, slot);
    const slotLen = slotEnd.getTime() - slotStart.getTime();
    const computeOverlap = (sd: Date, sh: number | null, ed: Date, eh: number | null) => {
      const es = toDateTime(sd, sh, 9).getTime();
      const ee = toDateTime(ed, eh, 21).getTime();
      return Math.max(0, Math.min(slotEnd.getTime(), ee) - Math.max(slotStart.getTime(), es));
    };
    const computeFracs = (sd: Date, sh: number | null, ed: Date, eh: number | null) => {
      const es = toDateTime(sd, sh, 9).getTime();
      const ee = toDateTime(ed, eh, 21).getTime();
      const startFrac = Math.max(0, Math.min(1, (es - slotStart.getTime()) / slotLen));
      const endFrac = Math.max(0, Math.min(1, (ee - slotStart.getTime()) / slotLen));
      return { startFrac, endFrac };
    };

    for (const rental of matchingRentals) {
      const rentalType = getRentalType(rental.billing_rate_type, rental.start_date, rental.actual_end_date || rental.planned_end_date);
      if (hideMonthly && rentalType === "monthly") continue;
      if (hideWeekly && rentalType === "weekly") continue;

      const startDate = parseISO(rental.start_date);
      const effectiveEndDate = rental.actual_end_date || rental.planned_end_date;
      const endDate = effectiveEndDate ? parseISO(effectiveEndDate) : addDays(startDate, 30);
      const endHour = parseHour(rental.actual_end_time || rental.planned_end_time);
      const startHour = parseHour(rental.start_time);

      const baseEvent = {
        type: "rental" as const,
        id: rental.id,
        customerName: rental.customer_name || "לקוח",
        status: rental.status,
        rentalType,
        endTime: (rental.actual_end_time || rental.planned_end_time) as string | null,
        startTime: rental.start_time as string | null,
      };

      const result = computeSlot(day, slot, startDate, endDate, startHour, endHour, baseEvent);
      if (result.status !== "free") {
        const fracs = computeFracs(startDate, startHour, endDate, endHour);
        const evMulti: SlotEvent = { ...baseEvent, ...fracs, timeLabel: result.timeLabel };
        candidates.push({ result, overlapMs: computeOverlap(startDate, startHour, endDate, endHour), eventForMulti: evMulti });
      }
    }

    // Check bookings
    const matchingBookings = bookings.filter(b => {
      const matchById = b.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, b.vehicle_details);
      if (!matchById && !matchByDetails) return false;
      if (b.status === "בוטל") return false;
      // Skip bookings that have already been converted to a rental — the rental represents them
      if (b.status === "פעיל" || b.status === "הושלם") return false;
      const start = parseISO(b.start_date);
      const end = parseISO(b.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    for (const booking of matchingBookings) {
      const bookingType = getRentalType(booking.billing_rate_type, booking.start_date, booking.end_date);
      if (hideMonthly && bookingType === "monthly") continue;
      if (hideWeekly && bookingType === "weekly") continue;

      const startDate = parseISO(booking.start_date);
      const endDate = parseISO(booking.end_date);
      const startHour = parseHour(booking.start_time);
      const endHour = parseHour(booking.end_time);

      const baseEvent = {
        type: "booking" as const,
        id: booking.id,
        customerName: booking.customer_name || "לקוח",
        status: booking.status,
        rentalType: bookingType,
        endTime: booking.end_time as string | null,
        startTime: booking.start_time as string | null,
      };

      const result = computeSlot(day, slot, startDate, endDate, startHour, endHour, baseEvent);
      if (result.status !== "free") {
        const fracs = computeFracs(startDate, startHour, endDate, endHour);
        const evMulti: SlotEvent = { ...baseEvent, ...fracs, timeLabel: result.timeLabel };
        candidates.push({ result, overlapMs: computeOverlap(startDate, startHour, endDate, endHour), eventForMulti: evMulti });
      }
    }

    if (candidates.length > 1) {
      // Multiple events in the same slot - render side by side by time
      const events = candidates
        .map(c => c.eventForMulti!)
        .sort((a, b) => a.startFrac - b.startFrac);
      return { status: "multi", events };
    }

    if (candidates.length === 1) {
      return candidates[0].result;
    }

    // Check maintenance tasks - רשומה אחת נפרשת על טווח [due_date .. end_date]
    const dayStr = format(day, "yyyy-MM-dd");
    const maintenance = maintenanceTasks.find(m => {
      if (m.vehicle_id !== vehicle.id) return false;
      if (!m.due_date) return false;
      const endStr = (m as any).end_date || m.due_date;
      return dayStr >= m.due_date && dayStr <= endStr;
    });

    if (maintenance) {
      const mStartTime = (maintenance as any).start_time as string | null;
      const mEndTime = (maintenance as any).end_time as string | null;
      const baseEvent = {
        type: "booking" as const,
        id: maintenance.id,
        customerName: maintenance.type || "טיפול",
        status: "בטיפול",
        rentalType: "daily",
        endTime: mEndTime,
        startTime: mStartTime,
      };
      // אם הוגדרו שעות - הן חלות על כל יום בטווח, נחשב רק את ה-slot הרלוונטי של היום הנוכחי
      if (mStartTime || mEndTime) {
        return computeSlot(day, slot, day, day, parseHour(mStartTime), parseHour(mEndTime), baseEvent);
      }
      return { status: "full", event: baseEvent };
    }

    return { status: "free" };
  };

  const getSlotBounds = (day: Date, slot: "am" | "pm") => {
    const slotStart = new Date(day);
    const slotEnd = new Date(day);

    if (slot === "am") {
      // Morning slot covers 09:00 to 16:00
      slotStart.setHours(9, 0, 0, 0);
      slotEnd.setHours(16, 0, 0, 0);
    } else {
      // Evening slot covers 16:00 to 00:00 (midnight)
      slotStart.setHours(16, 0, 0, 0);
      slotEnd.setHours(24, 0, 0, 0);
    }

    return { slotStart, slotEnd };
  };

  const toDateTime = (date: Date, hour: number | null, fallbackHour: number) => {
    const value = hour ?? fallbackHour;
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  };

  const computeSlot = (
    day: Date,
    slot: "am" | "pm",
    startDate: Date,
    endDate: Date,
    startHour: number | null,
    endHour: number | null,
    event: SlotResult["event"]
  ): SlotResult => {
    const { slotStart, slotEnd } = getSlotBounds(day, slot);
    const eventStart = toDateTime(startDate, startHour, 9);
    const eventEnd = toDateTime(endDate, endHour, 21);
    const minuteMs = 60_000;
    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotEnd.getTime();
    const eventStartMs = eventStart.getTime();
    const eventEndMs = eventEnd.getTime();

    const overlapStart = new Date(Math.max(slotStartMs, eventStartMs));
    const overlapEnd = new Date(Math.min(slotEndMs, eventEndMs));
    const overlapStartMs = overlapStart.getTime();
    const overlapEndMs = overlapEnd.getTime();

    if (overlapEndMs <= overlapStartMs) {
      return { status: "free" };
    }

    const slotLength = slotEndMs - slotStartMs;
    const overlapLength = overlapEndMs - overlapStartMs;
    const startsInSlot = eventStartMs >= slotStartMs && eventStartMs < slotEndMs;
    const endsInSlot = eventEndMs > slotStartMs && eventEndMs <= slotEndMs;
    const startLabel = event?.startTime?.slice(0, 5) ?? null;
    const endLabel = event?.endTime?.slice(0, 5) ?? null;

    if (overlapLength >= slotLength - minuteMs) {
      return {
        status: "full",
        event,
        timeLabel: startsInSlot ? startLabel : endsInSlot ? endLabel : null,
      };
    }

    const touchesSlotStart = overlapStartMs <= slotStartMs + minuteMs;
    const touchesSlotEnd = overlapEndMs >= slotEndMs - minuteMs;

    let partialSide: "start" | "end";
    if (touchesSlotStart && !touchesSlotEnd) {
      partialSide = "start";
    } else if (!touchesSlotStart && touchesSlotEnd) {
      partialSide = "end";
    } else {
      const overlapMidpoint = (overlapStartMs + overlapEndMs) / 2;
      const slotMidpoint = (slotStartMs + slotEndMs) / 2;
      partialSide = overlapMidpoint <= slotMidpoint ? "start" : "end";
    }

    const timeLabel = startsInSlot && !endsInSlot
      ? startLabel
      : !startsInSlot && endsInSlot
        ? endLabel
        : startsInSlot && endsInSlot
          ? partialSide === "start"
            ? startLabel
            : endLabel
          : endLabel || startLabel || null;

    return { status: "partial", partialSide, event, timeLabel };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "פעיל":
        return "bg-green-100 text-green-800 border-green-300";
      case "מאושר":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ממתין":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "בטיפול":
        return "bg-red-100 text-red-800 border-red-300";
      case "הושלם":
        return "bg-gray-100 text-gray-800 border-gray-300";
      case "בוטל":
        return "bg-gray-50 text-gray-500 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const formatDateRange = () => {
    return `${format(weekStart, "dd/MM/yy")} - ${format(weekEnd, "dd/MM/yy")}`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "week" ? "default" : "outline"} size="sm" onClick={() => setViewMode("week")}>שבועי</Button>
          <Button variant={viewMode === "month" ? "default" : "outline"} size="sm" onClick={() => setViewMode("month")}>חודשי</Button>
          <Button variant={viewMode === "unlimited" ? "default" : "outline"} size="sm" onClick={() => setViewMode("unlimited")}>הכל</Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>היום</Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : addDays(currentDate, -visibleDays))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{formatDateRange()}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : addDays(currentDate, visibleDays))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={hideWeekly} onCheckedChange={(checked) => setHideWeekly(checked === true)} />
            <span>הסתר שבועי</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={hideMonthly} onCheckedChange={(checked) => setHideMonthly(checked === true)} />
            <span>הסתר חודשי</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoomLevel <= 50}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[40px] text-center">{zoomLevel}%</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoomLevel >= 150}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-x-auto" style={{ maxHeight: '70vh' }}>
        <table 
          className="w-full border-collapse"
          style={{ zoom: `${zoomLevel}%` }}
        >
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50">
              {weekDays.map((day) => (
              <th
                key={day.toISOString()}
                colSpan={2}
                className={cn(
                  "border-2 border-foreground/20 p-1 text-center bg-muted/50",
                  isSameDay(day, new Date()) && "bg-accent/20"
                )}
              >
                  <div className="font-medium text-xs">
                    {format(day, "EEEE", { locale: he })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(day, "dd.MM")}
                  </div>
                </th>
              ))}
              <th className="border-2 border-foreground/20 p-1 text-right min-w-[100px] sticky right-0 bg-muted/50">רכב</th>
            </tr>
            <tr className="bg-muted/30">
              {weekDays.map((day) => (
                <React.Fragment key={`${day.toISOString()}-slots`}>
                  {/* ב-RTL: ה-th הראשון בקוד מופיע משמאל, השני מימין */}
                  {/* שמאל = ערב */}
                  <th className="border border-y-2 border-l-2 border-r border-foreground/20 p-0.5 text-[10px] text-center bg-indigo-50 text-indigo-900 font-medium">
                    ערב 16-00
                  </th>
                  {/* ימין = בוקר */}
                  <th className="border border-y-2 border-r-2 border-l border-foreground/20 p-0.5 text-[10px] text-center bg-amber-50 text-amber-900 font-medium">
                    בוקר 9-16
                  </th>
                </React.Fragment>
              ))}
              <th className="border-2 border-foreground/20 p-1 sticky right-0 bg-muted/30"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle, vIdx) => (
              <tr key={vehicle.id} className={cn(vIdx % 2 === 1 ? "bg-slate-100" : "bg-white", "hover:bg-cyan-50/40")}>
                {weekDays.map((day) => {
                  const amSlot = getSlotStatus(vehicle, day, "am");
                  const pmSlot = getSlotStatus(vehicle, day, "pm");

                  const renderSlot = (slotData: SlotResult, slotKey: string, slotType: "am" | "pm") => {
                    const soldDate = (vehicle as any).sold_date;
                    const dayStr = format(day, "yyyy-MM-dd");
                    const isSoldAfter = vehicle.status === "נמכר" && soldDate && dayStr > soldDate;

                    if (isSoldAfter) {
                      const daySeparatorClass2 = slotType === "pm"
                        ? "border border-y-2 border-l-2 border-r border-foreground/20"
                        : "border border-y-2 border-r-2 border-l border-foreground/20";
                      return (
                        <td key={slotKey} className={cn("p-0 h-8 bg-muted/40", daySeparatorClass2)}>
                          <div className="h-full w-full flex items-center justify-center">
                            <span className="text-[8px] text-muted-foreground/40">נמכר</span>
                          </div>
                        </td>
                      );
                    }

                    const handleClick = () => {
                      if (onCellClick) {
                        onCellClick(day, vehicle, slotData.event ? { ...slotData.event } : undefined, { slot: slotType, existingEndTime: slotData.event?.endTime });
                      } else if (slotData.status === "free" && onNewBooking) {
                        onNewBooking();
                      }
                    };

                    const daySeparatorClass = slotType === "pm"
                      ? "border border-y-2 border-l-2 border-r border-foreground/20"
                      : "border border-y-2 border-r-2 border-l border-foreground/20";

                    if (slotData.status === "full" && slotData.event) {
                      const timeStr = slotData.timeLabel || "";
                      return (
                        <td key={slotKey} className={cn("p-0 h-8", daySeparatorClass)}>
                          <div
                            onClick={handleClick}
                            className={cn(
                              "h-full rounded px-0.5 py-0 text-[10px] font-medium flex flex-col items-center justify-center border cursor-pointer hover:opacity-80 transition-opacity overflow-hidden",
                              getStatusColor(slotData.event.status)
                            )}
                            title={`${slotData.event.customerName} - ${slotData.event.status}${timeStr ? ` - ${timeStr}` : ""}`}
                          >
                            <span className="truncate w-full text-center leading-tight font-semibold">{slotData.event.customerName}</span>
                            {timeStr && <span className="text-[8px] opacity-70 leading-tight">{timeStr}</span>}
                          </div>
                        </td>
                      );
                    }

                    if (slotData.status === "multi" && slotData.events && slotData.events.length > 0) {
                      // RTL: צד ימין = תחילת הסלוט (startFrac=0), צד שמאל = סוף הסלוט (=1)
                      return (
                        <td key={slotKey} className={cn("p-0 h-8", daySeparatorClass)}>
                          <div className="relative h-full w-full" dir="ltr">
                            {slotData.events.map((ev, i) => {
                              const n = slotData.events!.length;
                              const widthPct = 100 / n;
                              const rightPct = i * widthPct;
                              return (
                                <div
                                  key={(ev.id || "") + i}
                                  onClick={() => {
                                    if (onCellClick) onCellClick(day, vehicle, { id: ev.id, customerName: ev.customerName, status: ev.status, startTime: ev.startTime, endTime: ev.endTime, type: ev.type }, { slot: slotType, existingEndTime: ev.endTime });
                                  }}
                                  className={cn(
                                    "absolute inset-y-0 px-0.5 text-[8px] font-medium flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden border rounded",
                                    getStatusColor(ev.status)
                                  )}
                                  style={{ right: `${rightPct}%`, width: `${widthPct}%` }}
                                  title={`${ev.customerName} - ${ev.status}${ev.timeLabel ? ` - ${ev.timeLabel}` : ""}`}
                                >
                                  <span className="truncate leading-tight w-full text-center font-semibold">{ev.customerName.trim().split(" ").slice(-1)[0]}</span>
                                  {ev.timeLabel && <span className="text-[7px] opacity-70 leading-none">{ev.timeLabel}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    }

                    if (slotData.status === "partial" && slotData.event) {
                      // בתוך כל חצי-יום הזמן מתקדם מימין לשמאל: תחילת הסלוט בימין, סוף הסלוט בשמאל.
                      // 09:00-15:00 תופס את צד ימין של הבוקר; 15:00-16:00 תופס את צד שמאל של הבוקר.
                      const occupiedRight = slotData.partialSide === "start";
                      const occupiedContent = (
                        <div
                          onClick={handleClick}
                          className={cn(
                            "absolute inset-y-0 w-1/2 px-0.5 text-[8px] font-medium flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden",
                            occupiedRight ? "right-0 rounded-r border-l" : "left-0 rounded-l border-r",
                            getStatusColor(slotData.event.status)
                          )}
                          title={`${slotData.event.customerName} - ${slotData.event.status}`}
                        >
                          <span className="truncate leading-tight font-semibold">{slotData.event.customerName.trim().split(" ").slice(-1)[0]}</span>
                          {slotData.timeLabel && <span className="text-[7px] opacity-70 leading-none">{slotData.timeLabel}</span>}
                        </div>
                      );

                      const freeContent = (
                        <button
                          onClick={() => {
                            if (onCellClick) onCellClick(day, vehicle, undefined, { slot: slotType, existingEndTime: slotData.event?.endTime });
                            else if (onNewBooking) onNewBooking();
                          }}
                          className={cn(
                            "absolute inset-y-0 w-1/2 flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/30 transition-colors",
                            occupiedRight ? "left-0" : "right-0"
                          )}
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      );

                      return (
                        <td key={slotKey} className={cn("p-0 h-8", daySeparatorClass)}>
                          <div className="relative h-full w-full">
                            {freeContent}
                            {occupiedContent}
                          </div>
                        </td>
                      );
                    }

                    // Free
                    return (
                      <td key={slotKey} className={cn("p-0 h-8", daySeparatorClass)}>
                        <button
                          onClick={handleClick}
                          className="h-full w-full flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/30 transition-colors"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </td>
                    );
                  };

                  return (
                    <React.Fragment key={`${day.toISOString()}-${vehicle.id}`}>
                      {/* ב-RTL: ה-td הראשון בקוד מופיע משמאל = ערב, השני מימין = בוקר */}
                      {renderSlot(pmSlot, `${day.toISOString()}-${vehicle.id}-pm`, "pm")}
                      {renderSlot(amSlot, `${day.toISOString()}-${vehicle.id}-am`, "am")}
                    </React.Fragment>
                  );
                })}
                {/* Vehicle Info */}
                <td className={cn("border-2 border-foreground/20 p-1 sticky right-0", vIdx % 2 === 1 ? "bg-slate-100" : "bg-white")}>
                  <div className="text-right">
                    <div className="font-bold text-base tracking-wide">{vehicle.license_plate}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {vehicle.manufacturer} {vehicle.model}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-muted-foreground">מקרא:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
          <span>השכרה פעילה</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
          <span>הזמנה משוריינת</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
          <span>בטיפול</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
          <span>השכרה שהושלמה</span>
        </div>
      </div>
    </div>
  );
}
