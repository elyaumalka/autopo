import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  isSameDay, 
  parseISO, 
  isWithinInterval,
  differenceInDays
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

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));

  const getDateRange = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 7 };
    } else if (viewMode === "month") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 30 };
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
    const h = parseInt(time.split(":")[0]);
    return isNaN(h) ? null : h;
  };

  type SlotResult = {
    status: "full" | "partial" | "free";
    event?: {
      type: "rental" | "booking";
      id?: string;
      customerName: string;
      status: string;
      rentalType: "daily" | "weekly" | "monthly";
      endTime?: string | null;
      startTime?: string | null;
    };
  };

  const getSlotStatus = (vehicle: Vehicle, day: Date, slot: "am" | "pm"): SlotResult => {
    // Check active rentals first
    const rental = rentals.find(r => {
      const matchById = r.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, r.vehicle_details);
      if (!matchById && !matchByDetails) return false;
      const start = parseISO(r.start_date);
      const end = r.planned_end_date ? parseISO(r.planned_end_date) : addDays(start, 30);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    if (rental) {
      const rentalType = getRentalType(rental.billing_rate_type, rental.start_date, rental.actual_end_date || rental.planned_end_date);
      if (hideMonthly && rentalType === "monthly") return { status: "free" };
      if (hideWeekly && rentalType === "weekly") return { status: "free" };

      const event = {
        type: "rental" as const,
        id: rental.id,
        customerName: rental.customer_name || "לקוח",
        status: rental.status,
        rentalType,
        endTime: (rental.actual_end_time || rental.planned_end_time) as string | null,
        startTime: rental.start_time as string | null,
      };

      const startDate = parseISO(rental.start_date);
      const effectiveEndDate = rental.actual_end_date || rental.planned_end_date;
      const endDate = effectiveEndDate ? parseISO(effectiveEndDate) : addDays(startDate, 30);
      const isStartDay = isSameDay(day, startDate);
      const isEndDay = isSameDay(day, endDate);
      const endHour = parseHour(rental.actual_end_time || rental.planned_end_time) ?? parseHour(rental.start_time);
      const startHour = parseHour(rental.start_time);

      return computeSlot(slot, isStartDay, isEndDay, startHour, endHour, event);
    }

    // Check bookings
    const matchingBookings = bookings.filter(b => {
      const matchById = b.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, b.vehicle_details);
      if (!matchById && !matchByDetails) return false;
      if (b.status === "בוטל") return false;
      const start = parseISO(b.start_date);
      const end = parseISO(b.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    for (const booking of matchingBookings) {
      const bookingType = getRentalType(booking.billing_rate_type, booking.start_date, booking.end_date);
      if (hideMonthly && bookingType === "monthly") continue;
      if (hideWeekly && bookingType === "weekly") continue;

      const event = {
        type: "booking" as const,
        id: booking.id,
        customerName: booking.customer_name || "לקוח",
        status: booking.status,
        rentalType: bookingType,
        endTime: booking.end_time as string | null,
        startTime: booking.start_time as string | null,
      };

      const startDate = parseISO(booking.start_date);
      const endDate = parseISO(booking.end_date);
      const isStartDay = isSameDay(day, startDate);
      const isEndDay = isSameDay(day, endDate);
      const startHour = parseHour(booking.start_time);
      const endHour = parseHour(booking.end_time);

      const result = computeSlot(slot, isStartDay, isEndDay, startHour, endHour, event);
      if (result.status !== "free") return result;
    }

    // Check maintenance tasks
    const maintenance = maintenanceTasks.find(m => {
      if (m.vehicle_id !== vehicle.id) return false;
      if (!m.due_date) return false;
      return isSameDay(day, parseISO(m.due_date));
    });

    if (maintenance) {
      return {
        status: "full",
        event: {
          type: "booking" as const,
          id: maintenance.id,
          customerName: maintenance.type || "טיפול",
          status: "בטיפול",
          rentalType: "daily",
          endTime: null,
          startTime: null,
        }
      };
    }

    return { status: "free" };
  };

  // Compute whether a slot is full, partial, or free
  const computeSlot = (
    slot: "am" | "pm",
    isStartDay: boolean,
    isEndDay: boolean,
    startHour: number | null,
    endHour: number | null,
    event: SlotResult["event"]
  ): SlotResult => {
    // Middle day - fully occupied
    if (!isStartDay && !isEndDay) return { status: "full", event };

    // Same day start+end (e.g. half-day)
    if (isStartDay && isEndDay) {
      const sh = startHour ?? 9;
      const eh = endHour ?? 16;
      if (slot === "am") {
        // AM = 9-16. If booking is entirely in PM range, AM is free
        if (sh >= 16) return { status: "free" };
        // If ends before AM starts, free
        if (eh <= 9) return { status: "free" };
        return { status: "full", event };
      } else {
        // PM = 16-9 next day. If booking ends before PM, free
        if (eh <= 16) return { status: "free" };
        return { status: "full", event };
      }
    }

    // Start day only - car is taken from startHour onward
    if (isStartDay && !isEndDay) {
      const h = startHour ?? 9;
      if (slot === "am") {
        // AM = 9-16. If pickup is at 14:00+, car is available most of morning → free
        if (h >= 14) return { status: "free" };
        // If pickup is 10-13, show partial (car available early morning)
        if (h >= 10) return { status: "partial", event };
        // Early morning pickup → full
        return { status: "full", event };
      } else {
        // PM = 16-9 next day. Car is always gone in PM on start day
        // If very late start (>=20), show partial to allow another booking before
        if (h >= 20) return { status: "partial", event };
        return { status: "full", event };
      }
    }

    // End day only - car returns at endHour
    if (isEndDay && !isStartDay) {
      const h = endHour ?? 16;
      if (slot === "am") {
        // AM = 9-16. If returns early morning (<=10), AM is free
        if (h <= 10) return { status: "free" };
        // If returns during PM hours, AM fully occupied
        if (h >= 16) return { status: "full", event };
        // Returns mid-AM → partial (car returns during this slot)
        return { status: "partial", event };
      } else {
        // PM = 16-9. If returns before PM, free
        if (h <= 16) return { status: "free" };
        // Returns during PM → partial
        return { status: "partial", event };
      }
    }

    return { status: "full", event };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "פעיל":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "מאושר":
        return "bg-green-100 text-green-800 border-green-300";
      case "ממתין":
        return "bg-blue-100 text-blue-800 border-blue-300";
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
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -visibleDays))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{formatDateRange()}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, visibleDays))}>
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
                  <th className="border border-y-2 border-l-2 border-r border-foreground/20 p-0.5 text-[10px] text-center bg-muted/30">
                    16-9
                  </th>
                  <th className="border border-y-2 border-r-2 border-l border-foreground/20 p-0.5 text-[10px] text-center bg-muted/30">
                    9-16
                  </th>
                </React.Fragment>
              ))}
              <th className="border-2 border-foreground/20 p-1 sticky right-0 bg-muted/30"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-muted/20">
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
                      const sTime = slotData.event.startTime?.slice(0, 5);
                      const eTime = slotData.event.endTime?.slice(0, 5);
                      // Show start time on cells so we know when customer arrives
                      const timeStr = sTime || eTime || "";
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
                            <span className="truncate w-full text-center leading-tight">{slotData.event.customerName}</span>
                            {timeStr && <span className="text-[8px] opacity-70 leading-tight">{timeStr}</span>}
                          </div>
                        </td>
                      );
                    }

                    if (slotData.status === "partial" && slotData.event) {
                      return (
                        <td key={slotKey} className={cn("p-0 h-8", daySeparatorClass)}>
                          <div className="h-full flex flex-row-reverse">
                            <div
                              onClick={handleClick}
                              className={cn(
                                "w-1/2 h-full rounded-r px-0.5 text-[8px] font-medium flex flex-col items-center justify-center border-l cursor-pointer hover:opacity-80 transition-opacity overflow-hidden",
                                getStatusColor(slotData.event.status)
                              )}
                              title={`${slotData.event.customerName} - ${slotData.event.status}`}
                            >
                              <span className="truncate leading-tight">{slotData.event.customerName.split(" ")[0]}</span>
                              {slotData.event.endTime && <span className="text-[7px] opacity-70 leading-none">{slotData.event.endTime.slice(0,5)}</span>}
                            </div>
                            <button
                              onClick={() => {
                                if (onCellClick) onCellClick(day, vehicle, undefined, { slot: slotType, existingEndTime: slotData.event?.endTime });
                                else if (onNewBooking) onNewBooking();
                              }}
                              className="w-1/2 h-full flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/30 transition-colors"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
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
                      {renderSlot(pmSlot, `${day.toISOString()}-${vehicle.id}-pm`, "pm")}
                      {renderSlot(amSlot, `${day.toISOString()}-${vehicle.id}-am`, "am")}
                    </React.Fragment>
                  );
                })}
                {/* Vehicle Info */}
                <td className="border-2 border-foreground/20 p-1 sticky right-0 bg-white">
                  <div className="text-right">
                    <div className="font-medium text-xs">{vehicle.license_plate}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
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
          <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
          <span>פעיל</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
          <span>מאושר</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300"></div>
          <span>ממתין</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-300"></div>
          <span>בטיפול</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
          <span>הושלם</span>
        </div>
      </div>
    </div>
  );
}
