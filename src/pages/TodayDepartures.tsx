import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Calendar, Phone, User, Car, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatHebrewDate, formatCurrency, formatTime } from "@/lib/formatters";
import { LoadingPage } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

export default function TodayDepartures() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["todayDepartures", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .eq("status", "מאושר")
        .eq("start_date", today);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <LoadingPage text="טוען יציאות היום..." />;
  }

  return (
    <div className="gradient-departures min-h-screen p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="gap-2 text-green-700 hover:bg-green-100"
        >
          חזרה לתפריט ראשי
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="h-12 w-12 overflow-hidden rounded-full bg-white shadow-lg">
          <img src={LOGO_URL} alt="Autopo" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold text-green-700">יציאות רכבים</h1>
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Calendar className="h-5 w-5" />
          <span className="text-lg">{formatHebrewDate(new Date())}</span>
        </div>
        <p className="mt-2 text-gray-500">לחץ על כרטיס להתחלת השכרה</p>
      </div>

      {/* Bookings Grid */}
      {bookings && bookings.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => navigate(`/start-rental/${booking.id}`)}
              className="card-hover flex flex-col rounded-2xl bg-white p-6 text-right shadow-lg"
            >
              {/* Customer Info */}
              <div className="mb-4 flex items-start gap-3 border-b pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <User className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-800">
                    {booking.customer?.first_name} {booking.customer?.last_name}
                  </p>
                  <p className="flex items-center gap-1 text-gray-500">
                    <Phone className="h-4 w-4" />
                    {booking.customer?.phone}
                  </p>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Car className="h-5 w-5 text-green-600" />
                  <span className="font-medium">
                    {booking.vehicle?.manufacturer} {booking.vehicle?.model}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {booking.vehicle?.license_plate}
                </p>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>שעה: {formatTime(booking.start_time)}</span>
                </div>
              </div>

              {/* Cost & Type */}
              <div className="mt-auto border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">עלות:</span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(booking.rental_cost || 0)}
                  </span>
                </div>
                {booking.rental_type && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-gray-500">תקופה:</span>
                    <span className="text-gray-700">{booking.rental_type}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4">
                <div className="w-full rounded-lg bg-green-500 py-3 text-center font-medium text-white transition-colors hover:bg-green-600">
                  התחל השכרה
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Car className="h-12 w-12 text-green-300" />}
          title="אין יציאות מתוכננות להיום"
          description="כל ההזמנות להיום כבר טופלו או שאין הזמנות חדשות"
          action={
            <Button onClick={() => navigate("/bookings")} variant="outline">
              עבור להזמנות
            </Button>
          }
        />
      )}
    </div>
  );
}
