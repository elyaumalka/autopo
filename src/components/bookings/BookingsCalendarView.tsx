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
  const [zoomLevel, setZoomLevel] = useState(100); // CSS zoom percentage

  // Zoom controls - CSS zoom
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 10, 50));

  // Get date range based on view mode
  const getDateRange = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 7 };
    } else if (viewMode === "month") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 30 };
    } else {
      // unlimited - show 60 days
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { start, days: 60 };
    }
  };

  const { start: weekStart, days: visibleDays } = getDateRange();
  const weekEnd = addDays(weekStart, visibleDays - 1);
  const weekDays = Array.from({ length: visibleDays }, (_, i) => addDays(weekStart, i)).reverse(); // RTL order

  // Fetch all vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .not("status", "eq", "נמכר")
        .order("license_plate");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch bookings for the week
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

  // Fetch active rentals
  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("status", "פעיל");
      if (error) throw error;
      return data || [];
    },
  });

  // Helper to match vehicle by license plate (from vehicle_details string)
  const matchVehicleToDetails = (vehicleLicensePlate: string, details: string | null) => {
    if (!details) return false;
    return details.includes(vehicleLicensePlate);
  };

  // Helper to determine rental type based on duration
  const getRentalType = (startDate: string, endDate: string | null): "daily" | "weekly" | "monthly" => {
    if (!endDate) return "monthly"; // No end date = monthly
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = differenceInDays(end, start);
    
    if (days >= 25) return "monthly";
    if (days >= 6) return "weekly";
    return "daily";
  };

  // Parse hour from time string like "10:00" -> 10
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

  // Get slot status for a specific vehicle, day, and time slot (am=9-16, pm=16-9)
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
      const rentalType = getRentalType(rental.start_date, rental.planned_end_date);
      if (hideMonthly && rentalType === "monthly") return { status: "free" };
      if (hideWeekly && rentalType === "weekly") return { status: "free" };

      const event = {
        type: "rental" as const,
        id: rental.id,
        customerName: rental.customer_name || "לקוח",
        status: "פעיל" as const,
        rentalType,
        endTime: rental.planned_end_time as string | null,
        startTime: rental.start_time as string | null,
      };

      const startDate = parseISO(rental.start_date);
      const endDate = rental.planned_end_date ? parseISO(rental.planned_end_date) : addDays(startDate, 30);
      const isStartDay = isSameDay(day, startDate);
      const isEndDay = isSameDay(day, endDate);
      const endHour = parseHour(rental.planned_end_time) ?? parseHour(rental.start_time);
      const startHour = parseHour(rental.start_time);

      return computeSlot(slot, isStartDay, isEndDay, startHour, endHour, event);
    }

    // Check bookings - find ALL matching bookings for this day/vehicle
    const matchingBookings = bookings.filter(b => {
      const matchById = b.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, b.vehicle_details);
      if (!matchById && !matchByDetails) return false;
      if (b.status === "בוטל" || b.status === "הושלם") return false;
      const start = parseISO(b.start_date);
      const end = parseISO(b.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    // For each matching booking, check if it occupies THIS specific slot
    for (const booking of matchingBookings) {
      const bookingType = getRentalType(booking.start_date, booking.end_date);
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

  // Compute whether a slot is full, partial, or free based on start/end day and times
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

  // End day only
    if (isEndDay && !isStartDay) {
      const h = endHour ?? 16;
      if (slot === "am") {
        // AM = 9-16. If returns by 10:00 AM or earlier, don't occupy this day at all
        return h <= 10 ? { status: "free" } : h >= 16 ? { status: "full", event } : { status: "partial", event };
      } else {
        // PM = 16+. If end at 17 or before, PM is free (booking essentially ends in AM zone).
        return h <= 17 ? { status: "free" } : { status: "partial", event };
      }
    }

    // Start day only
    if (isStartDay && !isEndDay) {
      const h = startHour ?? 9; // default start at 9:00
      if (slot === "am") {
        return h >= 16 ? { status: "free" } : h <= 9 ? { status: "full", event } : { status: "partial", event };
      } else {
        return { status: "full", event };
      }
    }

    // Same day start+end
    if (isStartDay && isEndDay) {
      const sh = startHour ?? 9;
      const eh = endHour ?? 16;
      if (slot === "am") {
        // AM = 9-16. If booking doesn't touch AM at all, free. If it covers to 16 or beyond, full. Otherwise partial.
        if (sh >= 16 || eh <= 9) return { status: "free" };
        if (eh >= 16) return { status: "full", event };
        return { status: "partial", event };
      } else {
        // PM = 16+. If end at 17 or before, PM is free. Otherwise partial.
        if (eh <= 17) return { status: "free" };
        return { status: "partial", event };
      }
    }

    return { status: "full", event };
  };

  // Get status color
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
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
          >
            שבועי
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            חודשי
          </Button>
          <Button
            variant={viewMode === "unlimited" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("unlimited")}
          >
            הכל
          </Button>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            היום
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -visibleDays))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {formatDateRange()}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, visibleDays))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={hideWeekly}
              onCheckedChange={(checked) => setHideWeekly(checked === true)}
            />
            <span>הסתר שבועי</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={hideMonthly}
              onCheckedChange={(checked) => setHideMonthly(checked === true)}
            />
            <span>הסתר חודשי</span>
          </label>
        </div>

        {/* Zoom Controls */}
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
              {/* Day Headers - RTL order */}
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  colSpan={2}
                  className={cn(
                    "border p-1 text-center bg-muted/50",
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
              {/* Vehicle Column Header */}
              <th className="border p-1 text-right min-w-[100px] sticky right-0 bg-muted/50">
                רכב
              </th>
            </tr>
            <tr className="bg-muted/30">
              {/* Time Slots Headers */}
              {weekDays.map((day) => (
                <React.Fragment key={`${day.toISOString()}-slots`}>
                  <th className="border p-0.5 text-[10px] text-center bg-muted/30">
                    16-9
                  </th>
                  <th className="border p-0.5 text-[10px] text-center bg-muted/30">
                    9-16
                  </th>
                </React.Fragment>
              ))}
              <th className="border p-1 sticky right-0 bg-muted/30"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-muted/20">
                {/* Day Cells - RTL order */}
                {weekDays.map((day) => {
                  const amSlot = getSlotStatus(vehicle, day, "am");
                  const pmSlot = getSlotStatus(vehicle, day, "pm");

                  const renderSlot = (slotData: SlotResult, slotKey: string, slotType: "am" | "pm") => {
                    const handleClick = () => {
                      if (onCellClick) {
                        onCellClick(day, vehicle, slotData.event ? { ...slotData.event } : undefined, { slot: slotType, existingEndTime: slotData.event?.endTime });
                      } else if (slotData.status === "free" && onNewBooking) {
                        onNewBooking();
                      }
                    };

                    if (slotData.status === "full" && slotData.event) {
                      const sTime = slotData.event.startTime?.slice(0, 5);
                      const eTime = slotData.event.endTime?.slice(0, 5);
                      // Show the most informative time: for non-standard starts show start, otherwise show end
                      const timeStr = (sTime && sTime !== "09:00" && sTime !== "10:00") ? sTime : (eTime || "");
                      return (
                        <td key={slotKey} className="border p-0 h-8">
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
                        <td key={slotKey} className="border p-0 h-8">
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
                      <td key={slotKey} className="border p-0 h-8">
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
                <td className="border p-1 sticky right-0 bg-white">
                  <div className="flex items-center gap-1">
                    {onMaintenanceClick && (
                      <button
                        onClick={() => onMaintenanceClick(vehicle)}
                        className="p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="שריון לטיפול"
                      >
                        <Wrench className="h-3 w-3" />
                      </button>
                    )}
                    <div className="text-right flex-1">
                      <div className="font-medium text-xs">{vehicle.license_plate}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {vehicle.manufacturer} {vehicle.model}
                      </div>
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
      </div>
    </div>
  );
}
