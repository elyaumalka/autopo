import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ChevronRight, 
  ChevronLeft, 
  ZoomIn, 
  ZoomOut, 
  Plus 
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

interface BookingsCalendarViewProps {
  onNewBooking?: () => void;
  onCellClick?: (date: Date, vehicle: Vehicle, booking?: any) => void;
}

export default function BookingsCalendarView({ onNewBooking, onCellClick }: BookingsCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [hideMonthly, setHideMonthly] = useState(false);
  const [hideWeekly, setHideWeekly] = useState(false);
  const [visibleDays, setVisibleDays] = useState(7);

  // Zoom controls - change number of visible days
  const handleZoomIn = () => setVisibleDays((prev) => Math.max(prev - 1, 3));
  const handleZoomOut = () => setVisibleDays((prev) => Math.min(prev + 1, 14));

  // Get date range based on visible days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
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
        .gte("end_date", format(weekStart, "yyyy-MM-dd"));
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

  // Get booking/rental for a specific vehicle and day
  const getVehicleEvent = (vehicle: Vehicle, day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    
    // Check active rentals first - match by vehicle_id OR vehicle_details containing license plate
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
      
      // Apply filters
      if (hideMonthly && rentalType === "monthly") return null;
      if (hideWeekly && rentalType === "weekly") return null;
      
      return {
        type: "rental" as const,
        customerName: rental.customer_name || "לקוח",
        status: "פעיל" as const,
        rentalType,
      };
    }

    // Check bookings - match by vehicle_id OR vehicle_details containing license plate
    const booking = bookings.find(b => {
      const matchById = b.vehicle_id === vehicle.id;
      const matchByDetails = matchVehicleToDetails(vehicle.license_plate, b.vehicle_details);
      
      if (!matchById && !matchByDetails) return false;
      
      const start = parseISO(b.start_date);
      const end = parseISO(b.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

    if (booking) {
      const bookingType = getRentalType(booking.start_date, booking.end_date);
      
      // Apply filters
      if (hideMonthly && bookingType === "monthly") return null;
      if (hideWeekly && bookingType === "weekly") return null;
      
      return {
        type: "booking" as const,
        customerName: booking.customer_name || "לקוח",
        status: booking.status,
        rentalType: bookingType,
      };
    }

    return null;
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
            variant={viewMode === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("weekly")}
          >
            שבועי
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
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={visibleDays >= 14}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[40px] text-center">{visibleDays} ימים</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={visibleDays <= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table 
          className="w-full border-collapse"
        >
          <thead>
            <tr className="bg-muted/50">
              {/* Day Headers - RTL order */}
              {weekDays.map((day) => (
                <th
                  key={day.toISOString()}
                  colSpan={2}
                  className={cn(
                    "border p-1 text-center",
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
                <>
                  <th key={`${day.toISOString()}-am`} className="border p-0.5 text-[10px] text-center">
                    9-16
                  </th>
                  <th key={`${day.toISOString()}-pm`} className="border p-0.5 text-[10px] text-center">
                    16-9
                  </th>
                </>
              ))}
              <th className="border p-1 sticky right-0 bg-muted/30"></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-muted/20">
                {/* Day Cells - RTL order */}
                {weekDays.map((day) => {
                  const event = getVehicleEvent(vehicle, day);
                  const handleCellClick = () => {
                    if (onCellClick) {
                      onCellClick(day, vehicle, event ? { ...event, type: event.type } : undefined);
                    } else if (!event && onNewBooking) {
                      onNewBooking();
                    }
                  };

                  return (
                    <>
                      <td
                        key={`${day.toISOString()}-${vehicle.id}-am`}
                        className="border p-0 h-8"
                      >
                        {event ? (
                          <div
                            onClick={handleCellClick}
                            className={cn(
                              "h-full rounded px-0.5 py-0 text-[10px] font-medium flex items-center justify-center border cursor-pointer hover:opacity-80 transition-opacity truncate",
                              getStatusColor(event.status)
                            )}
                            title={`${event.customerName} - ${event.status}`}
                          >
                            {event.customerName.split(" ")[0]}
                          </div>
                        ) : (
                          <button
                            onClick={handleCellClick}
                            className="h-full w-full flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/30 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </td>
                      <td
                        key={`${day.toISOString()}-${vehicle.id}-pm`}
                        className="border p-0 h-8"
                      >
                        {event ? (
                          <div
                            onClick={handleCellClick}
                            className={cn(
                              "h-full rounded px-0.5 py-0 text-[10px] font-medium flex items-center justify-center border cursor-pointer hover:opacity-80 transition-opacity truncate",
                              getStatusColor(event.status)
                            )}
                            title={`${event.customerName} - ${event.status}`}
                          >
                            {event.customerName.split(" ")[0]}
                          </div>
                        ) : (
                          <button
                            onClick={handleCellClick}
                            className="h-full w-full flex items-center justify-center text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/30 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </td>
                    </>
                  );
                })}
                {/* Vehicle Info */}
                <td className="border p-1 sticky right-0 bg-white">
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
      </div>
    </div>
  );
}
