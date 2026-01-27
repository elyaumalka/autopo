import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowRight, ArrowLeft, Car, Check, Clock } from "lucide-react";
import { formatShortDate, formatCurrency, formatTime, formatHebrewDate } from "@/lib/formatters";
import { format, parseISO, isSameDay } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function DailySnapshot() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Departures (bookings starting today)
  const { data: departures, isLoading: departuresLoading } = useQuery({
    queryKey: ["departures", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), vehicle:vehicles(*)")
        .eq("start_date", dateStr)
        .eq("status", "מאושר");
      if (error) throw error;
      return data;
    },
  });

  // Returns (rentals ending today)
  const { data: returns, isLoading: returnsLoading } = useQuery({
    queryKey: ["returns", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("planned_end_date", dateStr)
        .eq("status", "פעיל");
      if (error) throw error;
      return data;
    },
  });

  // Available vehicles
  const { data: availableVehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ["availableVehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("status", "זמין");
      if (error) throw error;
      return data;
    },
  });

  // Rented vehicles
  const { data: rentedVehicles, isLoading: rentedLoading } = useQuery({
    queryKey: ["rentedVehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("status", "מושכר");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = departuresLoading || returnsLoading || vehiclesLoading || rentedLoading;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="תמונת מצב יומית"
        subtitle={formatHebrewDate(selectedDate)}
      />

      {/* Date Selector */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate((d) => new Date(d.getTime() - 86400000))}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[200px]">
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {format(selectedDate, "EEEE, d MMMM yyyy", { locale: he })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate((d) => new Date(d.getTime() + 86400000))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Button variant="secondary" onClick={() => setSelectedDate(new Date())}>
              היום
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Departures */}
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <ArrowRight className="h-5 w-5" />
                יציאות היום ({departures?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {departures && departures.length > 0 ? (
                <div className="space-y-3">
                  {departures.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.vehicle_details}</p>
                      </div>
                      <div className="text-left">
                        {booking.start_time && (
                          <p className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatTime(booking.start_time)}
                          </p>
                        )}
                        <p className="text-sm font-medium">{formatCurrency(booking.rental_cost || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="אין יציאות" description="אין הזמנות מתוכננות להיום" />
              )}
            </CardContent>
          </Card>

          {/* Returns */}
          <Card>
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <ArrowLeft className="h-5 w-5" />
                החזרות היום ({returns?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {returns && returns.length > 0 ? (
                <div className="space-y-3">
                  {returns.map((rental) => (
                    <div key={rental.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{rental.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{rental.vehicle_details}</p>
                      </div>
                      <div className="text-left">
                        {rental.planned_end_time && (
                          <p className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatTime(rental.planned_end_time)}
                          </p>
                        )}
                        {rental.remaining_payment && rental.remaining_payment > 0 && (
                          <p className="text-sm font-medium text-destructive">
                            נותר: {formatCurrency(rental.remaining_payment)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="אין החזרות" description="אין השכרות שמסתיימות היום" />
              )}
            </CardContent>
          </Card>

          {/* Available Vehicles */}
          <Card>
            <CardHeader className="bg-emerald-50 border-b">
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Check className="h-5 w-5" />
                רכבים זמינים ({availableVehicles?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {availableVehicles && availableVehicles.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <Car className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {vehicle.manufacturer} {vehicle.model}
                        </p>
                        <p className="text-xs text-muted-foreground">{vehicle.license_plate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="אין רכבים זמינים" description="כל הרכבים תפוסים" />
              )}
            </CardContent>
          </Card>

          {/* Rented Vehicles */}
          <Card>
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Car className="h-5 w-5" />
                רכבים תפוסים ({rentedVehicles?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {rentedVehicles && rentedVehicles.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {rentedVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <Car className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium">
                          {vehicle.manufacturer} {vehicle.model}
                        </p>
                        <p className="text-xs text-muted-foreground">{vehicle.license_plate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="אין רכבים תפוסים" description="כל הרכבים זמינים" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
