import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, User, Car, ArrowLeft, ArrowRight } from "lucide-react";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;
type Rental = Tables<"rentals">;

export default function TodayRentals() {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [endRentalOpen, setEndRentalOpen] = useState(false);
  const [endRentalData, setEndRentalData] = useState({
    actual_end_date: format(new Date(), "yyyy-MM-dd"),
    actual_end_time: format(new Date(), "HH:mm"),
    end_km: 0,
    additional_charges: 0,
    additional_charges_details: "",
  });
  const today = format(new Date(), "yyyy-MM-dd");
  const queryClient = useQueryClient();

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

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("planned_end_date", today)
        .eq("status", "פעיל");
      if (error) throw error;
      return data as Rental[];
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

  const handleReturnClick = (rental: Rental) => {
    const vehicle = vehicles.find((v) => v.id === rental.vehicle_id);
    setSelectedRental(rental);
    setEndRentalData({
      actual_end_date: format(new Date(), "yyyy-MM-dd"),
      actual_end_time: format(new Date(), "HH:mm"),
      end_km: vehicle?.current_km || 0,
      additional_charges: 0,
      additional_charges_details: "",
    });
    setEndRentalOpen(true);
  };

  const handleEndRental = async () => {
    if (!selectedRental) return;

    try {
      const vehicle = vehicles.find((v) => v.id === selectedRental.vehicle_id);
      const kmDiff = endRentalData.end_km - (selectedRental.start_km || 0);
      const kmLimit = vehicle?.km_limit || 0;
      const extraKm = Math.max(0, kmDiff - kmLimit);
      const extraKmCost = extraKm * (vehicle?.extra_km_price || 0);

      const totalCost =
        (selectedRental.base_cost || 0) +
        extraKmCost +
        (endRentalData.additional_charges || 0);
      const remainingPayment = totalCost - (selectedRental.paid_amount || 0);

      // Update rental
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          actual_end_date: endRentalData.actual_end_date,
          actual_end_time: endRentalData.actual_end_time,
          end_km: endRentalData.end_km,
          extra_km: extraKm,
          extra_km_cost: extraKmCost,
          additional_charges: endRentalData.additional_charges || 0,
          additional_charges_details: endRentalData.additional_charges_details,
          total_cost: totalCost,
          remaining_payment: remainingPayment,
          status: "הושלם",
        })
        .eq("id", selectedRental.id);

      if (rentalError) throw rentalError;

      // Update vehicle
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .update({
          status: "זמין",
          current_km: endRentalData.end_km,
        })
        .eq("id", selectedRental.vehicle_id);

      if (vehicleError) throw vehicleError;

      // Update booking
      if (selectedRental.booking_id) {
        await supabase
          .from("bookings")
          .update({ status: "הושלם" })
          .eq("id", selectedRental.booking_id);
      }

      // Create collection task if remaining payment
      if (remainingPayment > 0) {
        await supabase.from("collection_tasks").insert({
          customer_id: selectedRental.customer_id,
          customer_name: selectedRental.customer_name,
          rental_id: selectedRental.id,
          vehicle_id: selectedRental.vehicle_id,
          vehicle_details: selectedRental.vehicle_details,
          debt_date: endRentalData.actual_end_date,
          amount: remainingPayment,
          reason: "יתרת תשלום סיום השכרה",
          status: "פתוח",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });

      toast({ title: "ההשכרה הסתיימה בהצלחה!" });
      setEndRentalOpen(false);
      setSelectedRental(null);
    } catch (error) {
      console.error(error);
      toast({ title: "שגיאה בסיום ההשכרה", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center p-3">
              <img
                src={LOGO_URL}
                alt="Autopo Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Autopo CRM
          </h1>
          <p className="text-xl text-gray-700 font-semibold mb-6">
            ניהול השכרת רכב
          </p>

          {/* Date Badge */}
          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: he })}
            </h2>
          </div>
          <p className="text-gray-600 text-lg">השכרות והחזרות להיום</p>
        </div>

        {/* Departures Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              יוצאות היום ({bookings.length})
            </h2>
          </div>

          {bookings.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-xl text-gray-600">אין השכרות מתוכננות להיום</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bookings.map((booking) => {
                const customer = customers.find(
                  (c) => c.id === booking.customer_id
                );
                const vehicle = vehicles.find(
                  (v) => v.id === booking.vehicle_id
                );

                return (
                  <Card
                    key={booking.id}
                    className="p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-2 border-transparent hover:border-blue-400"
                    onClick={() => handleBookingClick(booking)}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-4 border-b">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {booking.customer_name}
                          </h3>
                          {customer?.phone && (
                            <p className="text-sm text-gray-500">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Car className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {vehicle?.manufacturer} {vehicle?.model}
                          </p>
                          <p className="text-sm text-gray-500">
                            {vehicle?.license_plate}
                          </p>
                        </div>
                      </div>

                      {booking.start_time && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            שעה: {booking.start_time}
                          </span>
                        </div>
                      )}

                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">עלות:</span>
                          <span className="text-xl font-bold text-blue-600">
                            ₪{booking.rental_cost?.toLocaleString()}
                          </span>
                        </div>
                        {booking.rental_type && (
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-500">
                              תקופה:
                            </span>
                            <span className="text-sm font-medium">
                              {booking.rental_type}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        התחל השכרה
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Returns Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              חוזרות היום ({rentals.length})
            </h2>
          </div>

          {rentals.length === 0 ? (
            <Card className="p-12 text-center bg-white">
              <div className="text-gray-400 mb-4">
                <Car className="w-16 h-16 mx-auto" />
              </div>
              <p className="text-xl text-gray-600">אין החזרות מתוכננות להיום</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rentals.map((rental) => {
                const customer = customers.find(
                  (c) => c.id === rental.customer_id
                );
                const vehicle = vehicles.find(
                  (v) => v.id === rental.vehicle_id
                );

                return (
                  <Card
                    key={rental.id}
                    className="p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-2 border-transparent hover:border-blue-400"
                    onClick={() => handleReturnClick(rental)}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 pb-4 border-b">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {rental.customer_name}
                          </h3>
                          {customer?.phone && (
                            <p className="text-sm text-gray-500">
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Car className="w-5 h-5 text-gray-400 mt-1" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {vehicle?.manufacturer} {vehicle?.model}
                          </p>
                          <p className="text-sm text-gray-500">
                            {vehicle?.license_plate}
                          </p>
                        </div>
                      </div>

                      {rental.planned_end_time && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            שעת החזרה: {rental.planned_end_time}
                          </span>
                        </div>
                      )}

                      <div className="pt-4 border-t">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-500">
                            ק"מ יציאה:
                          </span>
                          <span className="text-sm font-medium">
                            {rental.start_km?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            נותר לתשלום:
                          </span>
                          <span className="text-xl font-bold text-blue-600">
                            ₪{rental.remaining_payment?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>

                      <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                        סיום השכרה
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
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
              customer={
                customers.find((c) => c.id === selectedBooking.customer_id) ||
                null
              }
              vehicle={
                vehicles.find((v) => v.id === selectedBooking.vehicle_id) ||
                null
              }
              onComplete={handleComplete}
              onCancel={() => setWizardOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* End Rental Dialog */}
      <Dialog open={endRentalOpen} onOpenChange={setEndRentalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>סיום השכרה</DialogTitle>
          </DialogHeader>
          {selectedRental && (
            <div className="space-y-4">
              <Card className="p-4 bg-gray-50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">לקוח:</span>
                    <span className="font-medium">
                      {selectedRental.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">רכב:</span>
                    <span className="font-medium">
                      {selectedRental.vehicle_details}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ק"מ התחלה:</span>
                    <span className="font-medium">
                      {selectedRental.start_km?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>תאריך סיום</Label>
                  <Input
                    type="date"
                    value={endRentalData.actual_end_date}
                    onChange={(e) =>
                      setEndRentalData({
                        ...endRentalData,
                        actual_end_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>שעת סיום</Label>
                  <Input
                    type="time"
                    value={endRentalData.actual_end_time}
                    onChange={(e) =>
                      setEndRentalData({
                        ...endRentalData,
                        actual_end_time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>ק"מ סיום *</Label>
                <Input
                  type="number"
                  value={endRentalData.end_km}
                  onChange={(e) =>
                    setEndRentalData({
                      ...endRentalData,
                      end_km: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <Label>חיובים נוספים</Label>
                <Input
                  type="number"
                  value={endRentalData.additional_charges}
                  onChange={(e) =>
                    setEndRentalData({
                      ...endRentalData,
                      additional_charges: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="סכום"
                />
              </div>

              <div>
                <Label>פירוט חיובים נוספים</Label>
                <Textarea
                  value={endRentalData.additional_charges_details}
                  onChange={(e) =>
                    setEndRentalData({
                      ...endRentalData,
                      additional_charges_details: e.target.value,
                    })
                  }
                  placeholder="נזקים, איחורים, דוחות..."
                />
              </div>

              <Card className="p-4 bg-blue-50">
                <h3 className="font-semibold mb-2">סיכום עלויות</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>עלות בסיס:</span>
                    <span>₪{selectedRental.base_cost?.toLocaleString()}</span>
                  </div>
                  {(() => {
                    const vehicle = vehicles.find(
                      (v) => v.id === selectedRental.vehicle_id
                    );
                    const kmDiff =
                      endRentalData.end_km - (selectedRental.start_km || 0);
                    const kmLimit = vehicle?.km_limit || 0;
                    const extraKm = Math.max(0, kmDiff - kmLimit);
                    const extraKmCost = extraKm * (vehicle?.extra_km_price || 0);

                    return (
                      extraKm > 0 && (
                        <div className="flex justify-between text-orange-600">
                          <span>ק"מ נוסף ({extraKm}):</span>
                          <span>₪{extraKmCost.toLocaleString()}</span>
                        </div>
                      )
                    );
                  })()}
                  {endRentalData.additional_charges > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>חיובים נוספים:</span>
                      <span>
                        ₪{endRentalData.additional_charges.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>סה"כ:</span>
                    <span>
                      ₪
                      {(() => {
                        const vehicle = vehicles.find(
                          (v) => v.id === selectedRental.vehicle_id
                        );
                        const kmDiff =
                          endRentalData.end_km - (selectedRental.start_km || 0);
                        const extraKm = Math.max(
                          0,
                          kmDiff - (vehicle?.km_limit || 0)
                        );
                        const extraKmCost =
                          extraKm * (vehicle?.extra_km_price || 0);
                        return (
                          (selectedRental.base_cost || 0) +
                          extraKmCost +
                          (endRentalData.additional_charges || 0)
                        ).toLocaleString();
                      })()}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleEndRental}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  אישור וסיום
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEndRentalOpen(false)}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
