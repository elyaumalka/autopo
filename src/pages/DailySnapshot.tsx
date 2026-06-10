import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, ArrowLeft, Car, User, Clock, Phone, Trash2, Users, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import RentalDetailsDialog from "@/components/rentals/RentalDetailsDialog";
import QuickBookingDialog from "@/components/bookings/QuickBookingDialog";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isSameMonth } from "date-fns";
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
  const [monthViewDate, setMonthViewDate] = useState(new Date());
  // סעיף 21 - לחיצה על ריבוע רכב פותחת חלון לפי מצב הרכב
  const [detailRental, setDetailRental] = useState<Rental | null>(null);
  const [quickBookVehicle, setQuickBookVehicle] = useState<Vehicle | null>(null);
  const [startWizardBooking, setStartWizardBooking] = useState<Booking | null>(null);
  const queryClient = useQueryClient();

  // פתיחת רכב תפוס -> חלון השכרה פעילה
  const openVehicleRental = (vehicleId: string) => {
    const r = rentals.find((x) => x.vehicle_id === vehicleId && x.status === "פעיל")
      || rentals.find((x) => x.vehicle_id === vehicleId && x.status !== "הושלם" && x.status !== "בוטל");
    if (r) setDetailRental(r);
    else toast({ title: "לא נמצאה השכרה פעילה לרכב זה" });
  };

  // יצירת הזמנה מהירה מתוך תמונת המצב
  const handleSnapshotBooking = async (bookingData: any) => {
    try {
      if (!bookingData.customer_id && bookingData.customer_name) {
        const parts = bookingData.customer_name.trim().split(/\s+/);
        const { data: nc, error: ce } = await supabase.from("customers").insert({
          first_name: parts[0] || bookingData.customer_name,
          last_name: parts.slice(1).join(" ") || "-",
          phone: "",
          id_number: `חדש-${Date.now()}${Math.floor(Math.random() * 1000)}`,
          notes: "לקוח חדש - יש להשלים פרטים",
        }).select().single();
        if (ce) throw ce;
        bookingData.customer_id = nc.id;
      }
      const { error } = await supabase.from("bookings").insert({ ...bookingData, status: bookingData.status || "מאושר" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "ההזמנה נוצרה בהצלחה" });
      setQuickBookVehicle(null);
    } catch (e: any) {
      toast({ title: "שגיאה ביצירת הזמנה", description: e.message, variant: "destructive" });
    }
  };

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

  const getDayStats = (dateStr: string) => {
    const returning = rentals.filter(r => r.status === "פעיל" && r.planned_end_date === dateStr).length;
    const departing = bookings.filter(b => b.status === "מאושר" && b.start_date === dateStr).length;

    const busyIds = new Set<string>();
    rentals.forEach(r => {
      if (r.status === "פעיל" && r.vehicle_id) {
        if (r.start_date <= dateStr && (r.planned_end_date || "") >= dateStr) {
          busyIds.add(r.vehicle_id);
        }
      }
    });
    bookings.forEach(b => {
      if ((b.status === "מאושר" || b.status === "פעיל") && b.vehicle_id) {
        if (b.start_date <= dateStr && b.end_date >= dateStr) {
          busyIds.add(b.vehicle_id);
        }
      }
    });

    const totalActive = vehicles.filter(v => v.status !== "נמכר" && v.status !== "לא פעיל").length;
    const busy = busyIds.size;
    const available = Math.max(0, totalActive - busy);

    return { returning, departing, busy, available };
  };

  // Day view calculations
  const returningVehicles = rentals.filter(r => r.status === "פעיל" && r.planned_end_date === selectedDate);
  const departingVehicles = bookings.filter(b => b.status === "מאושר" && b.start_date === selectedDate);

  // Busy = any vehicle with an active rental or confirmed booking spanning the selected date
  const busyVehicleIds = new Set<string>();
  rentals.forEach(r => {
    if (r.status === "פעיל" && r.vehicle_id) {
      const end = r.planned_end_date || "9999-12-31";
      if (r.start_date <= selectedDate && end >= selectedDate) {
        busyVehicleIds.add(r.vehicle_id);
      }
    }
  });
  bookings.forEach(b => {
    if ((b.status === "מאושר" || b.status === "פעיל") && b.vehicle_id) {
      if (b.start_date <= selectedDate && b.end_date >= selectedDate) {
        busyVehicleIds.add(b.vehicle_id);
      }
    }
  });
  // Also mark vehicles in maintenance/accident as busy
  vehicles.forEach(v => {
    if (v.status === "בטיפול" || v.status === "תאונה") {
      busyVehicleIds.add(v.id);
    }
  });

  const activeVehicles = vehicles.filter(v => v.status !== "נמכר" && v.status !== "לא פעיל");
  const availableVehicles = activeVehicles.filter(v => !busyVehicleIds.has(v.id));
  const busyVehicles = activeVehicles.filter(v => busyVehicleIds.has(v.id));

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

  // Month grid
  const monthStart = startOfMonth(monthViewDate);
  const monthEnd = endOfMonth(monthViewDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

  return (
    <div dir="rtl">
      <PageHeader
        title="תמונת מצב יומית"
        subtitle="רכבים שחוזרים ויוצאים"
        icon={Calendar}
      />

      <Tabs defaultValue="day" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="day">תצוגת יום</TabsTrigger>
          <TabsTrigger value="month">תצוגת חודש</TabsTrigger>
        </TabsList>

        {/* === DAY VIEW === */}
        <TabsContent value="day" className="space-y-6">
          {/* Date Selector */}
          <div className="flex items-center justify-center gap-3" dir="ltr">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
            >
              היום
            </Button>

            <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex flex-col items-center gap-1">
              <Label className="text-sm text-muted-foreground">בחר תאריך</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-44 text-center"
              />
            </div>

            <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {format(parseISO(selectedDate), "EEEE, dd MMMM yyyy", { locale: he })}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Returning Vehicles */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-destructive" />
                <h3 className="text-xl font-semibold">רכבים שחוזרים ({returningVehicles.length})</h3>
              </div>
              <div className="space-y-3">
                {returningVehicles.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">אין רכבים שחוזרים היום</Card>
                ) : (
                  returningVehicles.map((rental) => (
                    <Card key={rental.id} className="p-4 border-r-4 border-r-destructive cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailRental(rental)} title="לחץ לניהול ההשכרה">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Car className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{rental.vehicle_details}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>{rental.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{getCustomerPhone(rental.customer_id)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{rental.planned_end_time || "-"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-2">
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
                  <Card className="p-6 text-center text-muted-foreground">אין רכבים שיוצאים היום</Card>
                ) : (
                  departingVehicles.map((booking) => (
                    <Card key={booking.id} className="p-4 border-r-4 border-r-green-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStartWizardBooking(booking)} title="לחץ להתחלת השכרה">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Car className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold">{booking.vehicle_details}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-4 h-4" />
                            <span>{booking.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{getCustomerPhone(booking.customer_id)}</span>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                            <Clock className="w-4 h-4" />
                            <span>{booking.start_time || "-"}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openReassignDialog(booking); }} className="text-blue-600 h-7 w-7 p-0">
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteBooking(booking); }} className="text-destructive h-7 w-7 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-2">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-green-600">רכבים פנויים ({availableVehicles.length})</h3>
              <div className="space-y-2">
                {availableVehicles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">אין רכבים פנויים</p>
                ) : (
                  availableVehicles.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setQuickBookVehicle(v)}
                      className="flex w-full items-center gap-2 text-sm p-2 bg-green-50 rounded hover:bg-green-100 transition-colors text-right"
                      title="לחץ להזמנה חדשה"
                    >
                      <Car className="w-4 h-4 text-green-600" />
                      <span>{v.license_plate} - {v.manufacturer} {v.model}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3 text-destructive">רכבים תפוסים ({busyVehicles.length})</h3>
              <div className="space-y-2">
                {busyVehicles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">אין רכבים תפוסים</p>
                ) : (
                  busyVehicles.map(v => (
                    <button
                      key={v.id}
                      onClick={() => openVehicleRental(v.id)}
                      className="flex w-full items-center gap-2 text-sm p-2 bg-red-50 rounded hover:bg-red-100 transition-colors text-right"
                      title="לחץ לצפייה/ניהול ההשכרה"
                    >
                      <Car className="w-4 h-4 text-destructive" />
                      <span>{v.license_plate} - {v.manufacturer} {v.model}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* === MONTH VIEW === */}
        <TabsContent value="month" className="space-y-4">
          <div className="flex items-center justify-center gap-4" dir="ltr">
            <Button variant="secondary" size="sm" onClick={() => setMonthViewDate(new Date())}>
              החודש
            </Button>
            <Button variant="outline" size="icon" onClick={() => setMonthViewDate(prev => subMonths(prev, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold min-w-[200px] text-center">
              {format(monthViewDate, "MMMM yyyy", { locale: he })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setMonthViewDate(prev => addMonths(prev, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> חוזרים</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> יוצאים</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> תפוסים</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> פנויים</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {dayNames.map(name => (
              <div key={name} className="text-center text-sm font-semibold text-muted-foreground py-2">
                {name}
              </div>
            ))}

            {/* Empty cells before month start */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px]" />
            ))}

            {/* Day cells */}
            {monthDays.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const stats = getDayStats(dateStr);
              const today = isToday(day);
              const isSelected = dateStr === selectedDate;

              return (
                <Card
                  key={dateStr}
                  className={`min-h-[100px] p-2 cursor-pointer transition-all hover:shadow-md ${
                    today ? "ring-2 ring-primary" : ""
                  } ${isSelected ? "bg-primary/5" : ""}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  <div className={`text-sm font-bold mb-2 ${today ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {stats.returning > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <span className="text-muted-foreground">חוזרים</span>
                        <span className="font-bold mr-auto">{stats.returning}</span>
                      </div>
                    )}
                    {stats.departing > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                        <span className="text-muted-foreground">יוצאים</span>
                        <span className="font-bold mr-auto">{stats.departing}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                      <span className="text-muted-foreground">תפוסים</span>
                      <span className="font-bold mr-auto">{stats.busy}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-muted-foreground">פנויים</span>
                      <span className="font-bold mr-auto">{stats.available}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שינוי לקוח להזמנה</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">רכב: <strong>{selectedBooking.vehicle_details}</strong></p>
                <p className="text-sm text-muted-foreground">לקוח נוכחי: <strong>{selectedBooking.customer_name}</strong></p>
              </div>
              <div>
                <Label>בחר לקוח חדש</Label>
                <CustomerSearchSelect
                  customers={customers}
                  value={newCustomerId}
                  onValueChange={setNewCustomerId}
                  placeholder="בחר לקוח"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleReassignCustomer}
                  disabled={!newCustomerId || newCustomerId === selectedBooking.customer_id}
                  className="flex-1"
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

      {/* סעיף 21 - חלון השכרה פעילה בלחיצה על רכב תפוס */}
      <RentalDetailsDialog
        rental={detailRental}
        isOpen={!!detailRental}
        onClose={() => setDetailRental(null)}
      />

      {/* סעיף 21 - הזמנה חדשה בלחיצה על רכב פנוי */}
      <QuickBookingDialog
        isOpen={!!quickBookVehicle}
        onClose={() => setQuickBookVehicle(null)}
        onSubmit={handleSnapshotBooking}
        date={selectedDate}
        vehicle={quickBookVehicle}
        customers={customers}
      />

      {/* התחלת השכרה מהזמנה משוריינת (סעיף 21) */}
      {startWizardBooking && (
        <Dialog open={!!startWizardBooking} onOpenChange={(o) => { if (!o) setStartWizardBooking(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>תחילת השכרה</DialogTitle></DialogHeader>
            <RentalStartWizard
              booking={startWizardBooking}
              customer={customers.find((c) => c.id === startWizardBooking.customer_id) || null}
              vehicle={vehicles.find((v) => v.id === startWizardBooking.vehicle_id) || null}
              onComplete={() => {
                setStartWizardBooking(null);
                queryClient.invalidateQueries({ queryKey: ["bookings"] });
                queryClient.invalidateQueries({ queryKey: ["rentals"] });
                queryClient.invalidateQueries({ queryKey: ["vehicles"] });
              }}
              onCancel={() => setStartWizardBooking(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
