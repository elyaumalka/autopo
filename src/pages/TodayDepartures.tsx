import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, User, Car, ArrowRight } from "lucide-react";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import type { Tables } from "@/integrations/supabase/types";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

export default function TodayDepartures() {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const navigate = useNavigate();

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("start_date", today)
        .eq("status", "מאושר");
      if (error) throw error;
      return data as Booking[];
    },
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/rental-station")}
            className="shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            חזרה לתפריט ראשי
          </Button>

          <div className="flex justify-center">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center p-2">
              <img 
                src={LOGO_URL}
                alt="Autopo Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="w-32"></div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3 text-green-600">
            יציאות רכבים
          </h1>
          
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Calendar className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: he })}
            </h2>
          </div>
          <p className="text-gray-600 text-lg">לחץ על כרטיס להתחלת השכרה</p>
        </div>

        {bookings.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-16 h-16 mx-auto" />
            </div>
            <p className="text-xl text-gray-600">אין יציאות מתוכננות להיום</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((booking) => {
              const customer = customers.find(c => c.id === booking.customer_id);
              const vehicle = vehicles.find(v => v.id === booking.vehicle_id);

              return (
                <Card
                  key={booking.id}
                  className="p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-2 border-transparent hover:border-green-400"
                  onClick={() => handleBookingClick(booking)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {booking.customer_name}
                        </h3>
                        {customer?.phone && (
                          <p className="text-sm text-gray-500">{customer.phone}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Car className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {vehicle?.manufacturer} {vehicle?.model}
                        </p>
                        <p className="text-sm text-gray-500">{vehicle?.license_plate}</p>
                      </div>
                    </div>

                    {booking.start_time && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">שעה: {booking.start_time}</span>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">עלות:</span>
                        <span className="text-xl font-bold text-green-600">
                          ₪{booking.rental_cost?.toLocaleString()}
                        </span>
                      </div>
                      {booking.rental_type && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">תקופה:</span>
                          <span className="text-sm font-medium">{booking.rental_type}</span>
                        </div>
                      )}
                    </div>

                    <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                      התחל השכרה
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Rental Start Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תחילת השכרה</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <RentalStartWizard
              booking={selectedBooking}
              customer={customers.find(c => c.id === selectedBooking.customer_id) || null}
              vehicle={vehicles.find(v => v.id === selectedBooking.vehicle_id) || null}
              onComplete={handleComplete}
              onCancel={() => setWizardOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
