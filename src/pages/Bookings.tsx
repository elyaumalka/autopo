import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Plus, Search, List, CalendarDays, Phone, Car, User } from "lucide-react";
import { formatShortDate, formatCurrency, formatTime } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

export default function Bookings() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), vehicle:vehicles(*)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("status", "פעיל");
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["availableVehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("status", "זמין");
      if (error) throw error;
      return data;
    },
  });

  const createBooking = useMutation({
    mutationFn: async (booking: Partial<Booking>) => {
      const { data, error } = await supabase.from("bookings").insert(booking as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setDialogOpen(false);
      toast({ title: "ההזמנה נוצרה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה ביצירת הזמנה", description: error.message, variant: "destructive" });
    },
  });

  const filteredBookings = bookings?.filter((booking) => {
    const matchesSearch =
      booking.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.vehicle_details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get week dates
  const weekStart = startOfWeek(selectedDate, { locale: he });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get bookings for week view
  const weekBookings = bookings?.filter((b) => {
    const start = parseISO(b.start_date);
    const end = parseISO(b.end_date);
    return weekDays.some((day) => start <= day && end >= day);
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="הזמנות"
        subtitle="ניהול הזמנות השכרת רכב"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הזמנה חדשה
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>יצירת הזמנה חדשה</DialogTitle>
              </DialogHeader>
              <BookingForm
                customers={customers || []}
                vehicles={vehicles || []}
                onSubmit={(data) => createBooking.mutate(data)}
                isLoading={createBooking.isPending}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            רשימה
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            לוח שנה
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש לפי שם לקוח או רכב..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="ממתין">ממתין</SelectItem>
                    <SelectItem value="מאושר">מאושר</SelectItem>
                    <SelectItem value="פעיל">פעיל</SelectItem>
                    <SelectItem value="הושלם">הושלם</SelectItem>
                    <SelectItem value="בוטל">בוטל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingSpinner />
              ) : filteredBookings && filteredBookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>לקוח</TableHead>
                      <TableHead>רכב</TableHead>
                      <TableHead>תאריך התחלה</TableHead>
                      <TableHead>תאריך סיום</TableHead>
                      <TableHead>סוג</TableHead>
                      <TableHead>עלות</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.customer_name}</TableCell>
                        <TableCell>{booking.vehicle_details}</TableCell>
                        <TableCell>
                          {formatShortDate(booking.start_date)}
                          {booking.start_time && ` ${formatTime(booking.start_time)}`}
                        </TableCell>
                        <TableCell>
                          {formatShortDate(booking.end_date)}
                          {booking.end_time && ` ${formatTime(booking.end_time)}`}
                        </TableCell>
                        <TableCell>{booking.rental_type}</TableCell>
                        <TableCell>{formatCurrency(booking.rental_cost || 0)}</TableCell>
                        <TableCell>
                          <StatusBadge status={booking.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState title="אין הזמנות" description="לא נמצאו הזמנות במערכת" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>לוח הזמנות שבועי</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
                    שבוע קודם
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {format(selectedDate, "MMMM yyyy", { locale: he })}
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
                  <Button variant="outline" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
                    שבוע הבא
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="text-center">
                    <div className="rounded-t bg-muted p-2 font-medium">
                      {format(day, "EEEE", { locale: he })}
                    </div>
                    <div className={cn("border p-2 text-sm", isSameDay(day, new Date()) && "bg-primary/10")}>
                      {format(day, "d/M")}
                    </div>
                    <div className="min-h-[100px] space-y-1 border border-t-0 p-1">
                      {weekBookings
                        ?.filter((b) => {
                          const start = parseISO(b.start_date);
                          const end = parseISO(b.end_date);
                          return start <= day && end >= day;
                        })
                        .map((b) => (
                          <div
                            key={b.id}
                            className={cn(
                              "rounded p-1 text-xs",
                              b.status === "מאושר" && "bg-blue-100 text-blue-800",
                              b.status === "פעיל" && "bg-green-100 text-green-800",
                              b.status === "בוטל" && "bg-red-100 text-red-800",
                              b.status === "ממתין" && "bg-yellow-100 text-yellow-800"
                            )}
                          >
                            {b.customer_name}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface BookingFormProps {
  customers: Customer[];
  vehicles: Vehicle[];
  onSubmit: (data: Partial<Booking>) => void;
  isLoading: boolean;
}

function BookingForm({ customers, vehicles, onSubmit, isLoading }: BookingFormProps) {
  const [formData, setFormData] = useState({
    customer_id: "",
    vehicle_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "10:00",
    end_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    end_time: "10:00",
    rental_type: "24 שעות" as string,
    notes: "",
  });

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);
  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

  // Calculate rental cost based on type and vehicle rates
  const calculateCost = () => {
    if (!selectedVehicle) return 0;
    const rentalType = formData.rental_type;
    if (rentalType === "חצי יום") return selectedVehicle.half_day_rate || 0;
    if (rentalType === "24 שעות") return selectedVehicle.daily_rate || 0;
    if (rentalType === "שבוע") return (selectedVehicle.daily_rate || 0) * 7 * 0.85;
    if (rentalType === "חודש") return selectedVehicle.monthly_rate || 0;
    return 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.vehicle_id) {
      toast({ title: "נא לבחור לקוח ורכב", variant: "destructive" });
      return;
    }
    onSubmit({
      customer_id: formData.customer_id,
      customer_name: `${selectedCustomer?.first_name} ${selectedCustomer?.last_name}`,
      vehicle_id: formData.vehicle_id,
      vehicle_details: `${selectedVehicle?.manufacturer} ${selectedVehicle?.model} - ${selectedVehicle?.license_plate}`,
      start_date: formData.start_date,
      start_time: formData.start_time,
      end_date: formData.end_date,
      end_time: formData.end_time,
      rental_type: formData.rental_type as "24 שעות" | "חודש" | "חצי יום" | "שבוע",
      rental_cost: calculateCost(),
      notes: formData.notes,
      status: "מאושר",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>לקוח</Label>
          <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="בחר לקוח" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {c.first_name} {c.last_name} - {c.phone}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>רכב</Label>
          <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="בחר רכב" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    {v.manufacturer} {v.model} - {v.license_plate}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>תאריך התחלה</Label>
          <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>שעת התחלה</Label>
          <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>תאריך סיום</Label>
          <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>שעת סיום</Label>
          <Input type="time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>סוג השכרה</Label>
          <Select value={formData.rental_type} onValueChange={(v: any) => setFormData({ ...formData, rental_type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="חצי יום">חצי יום</SelectItem>
              <SelectItem value="24 שעות">24 שעות</SelectItem>
              <SelectItem value="שבוע">שבוע</SelectItem>
              <SelectItem value="חודש">חודש</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>עלות משוערת</Label>
          <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-medium">
            {formatCurrency(calculateCost())}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>הערות</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="הערות נוספות..." />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "שומר..." : "שמור הזמנה"}
        </Button>
      </div>
    </form>
  );
}
