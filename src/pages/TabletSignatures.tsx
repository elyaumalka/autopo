import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Car, User, Clock, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

export default function TabletSignatures() {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: bookings = [] } = useQuery({
    queryKey: ["today-bookings", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("start_date", today)
        .eq("status", "מאושר");
      if (error) throw error;
      return data as Booking[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setWizardOpen(true);
  };

  const handleComplete = () => {
    setWizardOpen(false);
    setSelectedBooking(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">חתימות היום</h1>
          <p className="text-gray-600">לחץ על הכרטיס שלך להתחלת תהליך החתימה</p>
          <p className="text-sm text-gray-500 mt-2">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: he })}
          </p>
        </div>

        {bookings.length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-xl text-gray-600">אין הזמנות להיום</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((booking) => (
              <Card
                key={booking.id}
                className="p-6 cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 bg-white border-2 border-cyan-200"
                onClick={() => handleBookingClick(booking)}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-bold text-xl text-gray-900">
                        {booking.customer_name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Car className="w-4 h-4" />
                      <span>{booking.vehicle_details}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{booking.start_time || "לא צוין"}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t text-center">
                    <p className="text-cyan-600 font-medium">לחץ להתחלת חתימה</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תחילת השכרה</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <RentalStartWizard
              booking={selectedBooking}
              customer={customers.find((c) => c.id === selectedBooking.customer_id) || null}
              vehicle={vehicles.find((v) => v.id === selectedBooking.vehicle_id) || null}
              onComplete={handleComplete}
              onCancel={() => setWizardOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
