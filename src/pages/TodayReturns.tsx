import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Calendar, Phone, User, Car, Clock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatHebrewDate, formatCurrency, formatTime, formatNumber } from "@/lib/formatters";
import { LoadingPage } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

export default function TodayReturns() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const { data: rentals, isLoading } = useQuery({
    queryKey: ["todayReturns", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*)
        `)
        .eq("status", "פעיל")
        .eq("planned_end_date", today);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <LoadingPage text="טוען החזרות היום..." />;
  }

  return (
    <div className="gradient-returns min-h-screen p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="gap-2 text-blue-700 hover:bg-blue-100"
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
        <h1 className="mb-2 text-4xl font-bold text-blue-700">החזרות רכבים</h1>
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Calendar className="h-5 w-5" />
          <span className="text-lg">{formatHebrewDate(new Date())}</span>
        </div>
        <p className="mt-2 text-gray-500">לחץ על כרטיס לסיום השכרה</p>
      </div>

      {/* Rentals Grid */}
      {rentals && rentals.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rentals.map((rental) => (
            <button
              key={rental.id}
              onClick={() => navigate(`/end-rental/${rental.id}`)}
              className="card-hover flex flex-col rounded-2xl bg-white p-6 text-right shadow-lg"
            >
              {/* Customer Info */}
              <div className="mb-4 flex items-start gap-3 border-b pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-800">
                    {rental.customer?.first_name} {rental.customer?.last_name}
                  </p>
                  <p className="flex items-center gap-1 text-gray-500">
                    <Phone className="h-4 w-4" />
                    {rental.customer?.phone}
                  </p>
                </div>
              </div>

              {/* Vehicle Info */}
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Car className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">
                    {rental.vehicle?.manufacturer} {rental.vehicle?.model}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {rental.vehicle?.license_plate}
                </p>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>שעת החזרה: {formatTime(rental.planned_end_time)}</span>
                </div>
              </div>

              {/* KM & Payment */}
              <div className="mt-auto border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Gauge className="h-4 w-4" />
                    ק״מ יציאה:
                  </span>
                  <span className="font-medium text-gray-700">
                    {formatNumber(rental.start_km || 0)}
                  </span>
                </div>
                {rental.remaining_payment !== undefined && rental.remaining_payment > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-500">נותר לתשלום:</span>
                    <span className="text-xl font-bold text-red-600">
                      {formatCurrency(rental.remaining_payment)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4">
                <div className="w-full rounded-lg bg-blue-500 py-3 text-center font-medium text-white transition-colors hover:bg-blue-600">
                  סיום השכרה
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Car className="h-12 w-12 text-blue-300" />}
          title="אין החזרות מתוכננות להיום"
          description="כל ההשכרות שהיו אמורות להסתיים היום כבר טופלו"
          action={
            <Button onClick={() => navigate("/rentals")} variant="outline">
              עבור להיסטוריית השכרות
            </Button>
          }
        />
      )}
    </div>
  );
}
