import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Car, User, Clock, Phone, Trash2, Users, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Rental = Tables<"rentals">;
type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

export default function DailySnapshot() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newCustomerId, setNewCustomerId] = useState("");
  const queryClient = useQueryClient();

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*");
      if (error) throw error;
      return data as Rental[];
    }
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*");
      if (error) throw error;
      return data as Booking[];
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
    }
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "ההזמנה נמחקה" });
    }
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Booking> }) => {
      const { error } = await supabase.from("bookings").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setEditDialogOpen(false);
      toast({ title: "ההזמנה עודכנה" });
    }
  });

  const handleDeleteBooking = (booking: Booking) => {
    if (confirm(`האם למחוק את ההזמנה של ${booking.customer_name}?`)) {
      deleteBookingMutation.mutate(booking.id);
    }
  };

  const handleReassignCustomer = () => {
    if (!newCustomerId || !selectedBooking) return;
    
    const customer = customers.find(c => c.id === newCustomerId);
    if (!customer) return;

    updateBookingMutation.mutate({
      id: selectedBooking.id,
      data: {
        customer_id: newCustomerId,
        customer_name: `${customer.first_name} ${customer.last_name}`
      }
    });
  };

  const openReassignDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setNewCustomerId(booking.customer_id || "");
    setEditDialogOpen(true);
  };

  // רכבים שחוזרים בתאריך הנבחר
  const returningVehicles = rentals.filter(r => {
    if (r.status !== "פעיל") return false;
    // Use planned end date for active rentals
    return r.planned_end_date === selectedDate;
  });

  // רכבים שיוצאים בתאריך הנבחר
  const departingVehicles = bookings.filter(b => {
    if (b.status !== "מאושר") return false;
    return b.start_date === selectedDate;
  });

  // רכבים תפוסים
  const busyVehicleIds = [...new Set([
    ...returningVehicles.map(r => r.vehicle_id),
    ...departingVehicles.map(b => b.vehicle_id),
    ...rentals.filter(r => {
      if (r.status !== "פעיל") return false;
      return r.planned_end_date !== selectedDate;
    }).map(r => r.vehicle_id)
  ])];

  // רכבים פנויים
  const availableVehicles = vehicles.filter(v => 
    v.status === "זמין" && !busyVehicleIds.includes(v.id)
  );

  const busyVehicles = vehicles.filter(v => busyVehicleIds.includes(v.id));

  const getCustomerPhone = (customerId: string | null) => {
    if (!customerId) return "-";
    const customer = customers.find(c => c.id === customerId);
    return customer?.phone || "-";
  };

  const navigateDate = (days: number) => {
    const current = parseISO(selectedDate);
    const newDate = new Date(current);
    newDate.setDate(current.getDate() + days);
    setSelectedDate(format(newDate, "yyyy-MM-dd"));
  };

  return (
    <div>
      <PageHeader
        title="תמונת מצב יומית"
        subtitle="רכבים שחוזרים ויוצאים"
        icon={Calendar}
      />

      {/* Date Selector */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate(-1)}
        >
          <ArrowRight className="w-4 h-4" />
        </Button>
        
        <div className="flex-1 max-w-xs">
          <Label>בחר תאריך</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateDate(1)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
        >
          היום
        </Button>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {format(parseISO(selectedDate), "EEEE, dd MMMM yyyy", { locale: he })}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Returning Vehicles */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-red-600" />
            <h3 className="text-xl font-semibold">רכבים שחוזרים ({returningVehicles.length})</h3>
          </div>

          <div className="space-y-3">
            {returningVehicles.length === 0 ? (
              <Card className="p-6 text-center text-gray-500">
                אין רכבים שחוזרים היום
              </Card>
            ) : (
              returningVehicles.map((rental) => (
                <Card key={rental.id} className="p-4 border-r-4 border-r-red-500">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Car className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{rental.vehicle_details}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{rental.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{getCustomerPhone(rental.customer_id)}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{rental.planned_end_time || "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500 mt-2">
                    <span>התחיל: {rental.start_date}</span>
                    <span>•</span>
                    <span>ק"מ התחלה: {rental.start_km}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Departing Vehicles */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 text-green-600" />
            <h3 className="text-xl font-semibold">רכבים שיוצאים ({departingVehicles.length})</h3>
          </div>

          <div className="space-y-3">
            {departingVehicles.length === 0 ? (
              <Card className="p-6 text-center text-gray-500">
                אין רכבים שיוצאים היום
              </Card>
            ) : (
              departingVehicles.map((booking) => (
                <Card key={booking.id} className="p-4 border-r-4 border-r-green-500">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Car className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">{booking.vehicle_details}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{booking.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{getCustomerPhone(booking.customer_id)}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                        <Clock className="w-4 h-4" />
                        <span>{booking.start_time || "-"}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openReassignDialog(booking)}
                          className="text-blue-600 h-7 w-7 p-0"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBooking(booking)}
                          className="text-red-600 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-500 mt-2">
                    <span>עד: {booking.end_date}</span>
                    <span>•</span>
                    <span>סוג: {booking.rental_type || "-"}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Vehicle Status */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3 text-green-600">רכבים פנויים ({availableVehicles.length})</h3>
          <div className="space-y-2">
            {availableVehicles.length === 0 ? (
              <p className="text-gray-500 text-sm">אין רכבים פנויים</p>
            ) : (
              availableVehicles.map(v => (
                <div key={v.id} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded">
                  <Car className="w-4 h-4 text-green-600" />
                  <span>{v.license_plate} - {v.manufacturer} {v.model}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3 text-red-600">רכבים תפוסים ({busyVehicles.length})</h3>
          <div className="space-y-2">
            {busyVehicles.length === 0 ? (
              <p className="text-gray-500 text-sm">אין רכבים תפוסים</p>
            ) : (
              busyVehicles.map(v => (
                <div key={v.id} className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded">
                  <Car className="w-4 h-4 text-red-600" />
                  <span>{v.license_plate} - {v.manufacturer} {v.model}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שינוי לקוח להזמנה</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">רכב: <strong>{selectedBooking.vehicle_details}</strong></p>
                <p className="text-sm text-gray-600">לקוח נוכחי: <strong>{selectedBooking.customer_name}</strong></p>
              </div>

              <div>
                <Label>בחר לקוח חדש</Label>
                <Select value={newCustomerId} onValueChange={setNewCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר לקוח" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} - {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleReassignCustomer}
                  disabled={!newCustomerId || newCustomerId === selectedBooking.customer_id}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                >
                  עדכון לקוח
                </Button>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
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
