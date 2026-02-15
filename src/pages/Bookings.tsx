import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Car, User, Search, CheckCircle, ArrowLeft, Eye, FileText, CalendarDays, Plus } from "lucide-react";
import BookingsCalendarView from "@/components/bookings/BookingsCalendarView";
import QuickBookingDialog from "@/components/bookings/QuickBookingDialog";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import { toast } from "@/hooks/use-toast";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Rental = Database["public"]["Tables"]["rentals"]["Row"];

export default function Bookings() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Booking>>({});
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState("calendar");
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [quickBookingData, setQuickBookingData] = useState<{ date: string; vehicle: Vehicle } | null>(null);
  const [rentalWizardOpen, setRentalWizardOpen] = useState(false);
  const [wizardBooking, setWizardBooking] = useState<Booking | null>(null);
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("status", "פעיל");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .not("status", "eq", "נמכר");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*");
      if (error) throw error;
      return data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Booking>) => {
      const { data: result, error } = await supabase
        .from("bookings")
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "ההזמנה נוצרה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה ביצירת הזמנה", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Booking> }) => {
      const { error } = await supabase
        .from("bookings")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "ההזמנה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון הזמנה", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "ההזמנה נמחקה" });
    }
  });

  const resetForm = () => {
    setFormData({});
    setStep(1);
    setSelectedBooking(null);
  };

  const isVehicleAvailable = (vehicleId: string, startDate: string, endDate: string, excludeBookingId?: string) => {
    const hasOverlap = bookings.some(b => {
      if (b.id === excludeBookingId) return false;
      if (b.vehicle_id !== vehicleId) return false;
      if (b.status === "בוטל" || b.status === "הושלם") return false;
      return startDate < b.end_date && endDate > b.start_date;
    });
    return !hasOverlap;
  };

  const getAvailableVehicles = () => {
    if (!formData.start_date || !formData.end_date) return [];
    return vehicles.filter(v => 
      v.status !== "נמכר" && 
      v.status !== "לא פעיל" &&
      isVehicleAvailable(v.id, formData.start_date!, formData.end_date!, selectedBooking?.id)
    );
  };

  const handleSubmit = () => {
    const customer = customers.find(c => c.id === formData.customer_id);
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
    
    const data: Partial<Booking> = {
      ...formData,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "",
      vehicle_details: vehicle ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}` : "",
      rental_cost: formData.rental_cost ? Number(formData.rental_cost) : 0,
      deposit_amount: formData.deposit_amount ? Number(formData.deposit_amount) : 0,
      credit_hold: formData.credit_hold ? Number(formData.credit_hold) : 0,
      status: formData.status || "מאושר"
    };

    if (selectedBooking) {
      updateMutation.mutate({ id: selectedBooking.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCalendarCellClick = (date: Date, vehicle: Vehicle, booking?: any) => {
    if (booking) {
      // יש הזמנה קיימת - פתח לעריכה
      const existingBooking = bookings.find(b => 
        b.vehicle_id === vehicle.id && 
        b.start_date <= format(date, "yyyy-MM-dd") && 
        b.end_date >= format(date, "yyyy-MM-dd") &&
        b.status !== "בוטל" && b.status !== "הושלם"
      );
      if (existingBooking) {
        setSelectedBooking(existingBooking);
        setFormData(existingBooking);
        setStep(1);
        setIsOpen(true);
      }
    } else {
      // תא ריק - פתח שריון מהיר
      setQuickBookingData({ date: format(date, "yyyy-MM-dd"), vehicle });
      setQuickBookingOpen(true);
    }
  };

  const handleQuickBookingSubmit = async (bookingData: any) => {
    // בדיקת זמינות
    if (!isVehicleAvailable(bookingData.vehicle_id, bookingData.start_date, bookingData.end_date)) {
      toast({ 
        title: "הרכב תפוס", 
        description: "הרכב כבר תפוס בתאריכים אלו. אנא בחר תאריכים אחרים.",
        variant: "destructive"
      });
      return;
    }
    
    await createMutation.mutateAsync(bookingData);
    setQuickBookingOpen(false);
    setQuickBookingData(null);
  };

  const handleQuickBookingSubmitAndStart = async (bookingData: any) => {
    // בדיקת זמינות
    if (!isVehicleAvailable(bookingData.vehicle_id, bookingData.start_date, bookingData.end_date)) {
      toast({ 
        title: "הרכב תפוס", 
        description: "הרכב כבר תפוס בתאריכים אלו. אנא בחר תאריכים אחרים.",
        variant: "destructive"
      });
      return;
    }
    
    const newBooking = await createMutation.mutateAsync(bookingData);
    setQuickBookingOpen(false);
    setQuickBookingData(null);
    
    // פתיחת אשף התחלת השכרה
    setWizardBooking(newBooking);
    setRentalWizardOpen(true);
  };

  const handleWizardComplete = () => {
    setRentalWizardOpen(false);
    setWizardBooking(null);
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["rentals"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vehicle_details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: "פעולות",
      cell: (row: Booking) => (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewingBooking(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedBooking(row);
              setFormData(row);
              setStep(1);
              setIsOpen(true);
            }}
          >
            עריכה
          </Button>
          {row.status === "מאושר" && (
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 ml-1" />
              התחל
            </Button>
          )}
        </div>
      )
    },
    {
      header: "סטטוס",
      cell: (row: Booking) => <StatusBadge status={row.status || "ממתין"} />
    },
    {
      header: "תשלום",
      cell: (row: Booking) => {
        const total = row.rental_cost || 0;
        const paid = row.deposit_amount || 0;
        const remaining = total - paid;
        
        return (
          <div className="text-sm">
            <div className="font-medium">₪{total.toLocaleString()}</div>
            {paid > 0 && (
              <div className="text-green-600 text-xs">שולם: ₪{paid.toLocaleString()}</div>
            )}
            {remaining > 0 && (
              <div className="text-red-600 text-xs">נותר: ₪{remaining.toLocaleString()}</div>
            )}
          </div>
        );
      }
    },
    {
      header: "תאריך סיום",
      cell: (row: Booking) => (
        <div className="text-sm">
          {row.end_date ? format(new Date(row.end_date), "dd/MM/yy") : "-"}
          {row.end_time && ` ${row.end_time.substring(0, 5)}`}
        </div>
      )
    },
    {
      header: "תאריך התחלה",
      cell: (row: Booking) => (
        <div className="text-sm">
          {row.start_date ? format(new Date(row.start_date), "dd/MM/yy") : "-"}
          {row.start_time && ` ${row.start_time.substring(0, 5)}`}
        </div>
      )
    },
    {
      header: "רכב",
      cell: (row: Booking) => (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-muted-foreground" />
          <span>{row.vehicle_details}</span>
        </div>
      )
    },
    {
      header: "לקוח",
      cell: (row: Booking) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{row.customer_name}</span>
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="הזמנות"
        subtitle={`${bookings.length} הזמנות`}
        action={
          <Button onClick={() => { resetForm(); setIsOpen(true); }}>
            <Plus className="ml-2 h-4 w-4" />
            הזמנה חדשה
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-muted">
            <CalendarDays className="h-4 w-4" />
            תמונת מצב
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-muted">
            <FileText className="h-4 w-4" />
            רשימת הזמנות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <BookingsCalendarView 
              onNewBooking={() => { resetForm(); setIsOpen(true); }}
              onCellClick={handleCalendarCellClick}
            />
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-6 mt-4">
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי לקוח או רכב..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
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

            <DataTable
              columns={columns}
              data={filteredBookings}
              isLoading={isLoading}
              emptyMessage="לא נמצאו הזמנות"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Booking Dialog */}
      {quickBookingData && (
        <QuickBookingDialog
          isOpen={quickBookingOpen}
          onClose={() => {
            setQuickBookingOpen(false);
            setQuickBookingData(null);
          }}
          onSubmit={handleQuickBookingSubmit}
          onSubmitAndStart={handleQuickBookingSubmitAndStart}
          date={quickBookingData.date}
          vehicle={quickBookingData.vehicle}
          customers={customers}
        />
      )}

      {/* Create/Edit Booking Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBooking ? "עריכת הזמנה" : "הזמנה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-6">
              {["תאריכים", "רכב", "פרטים"].map((s, i) => (
                <div key={i} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step > i + 1 ? 'bg-accent text-accent-foreground' : step === i + 1 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}
                  `}>
                    {i + 1}
                  </div>
                  <span className={`mr-2 text-sm ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
                  {i < 2 && <div className="w-12 h-0.5 bg-muted mx-2" />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>לקוח *</Label>
                  <CustomerSearchSelect
                    customers={customers}
                    value={formData.customer_id || ""}
                    onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                    placeholder="בחר לקוח"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>תאריך התחלה *</Label>
                    <Input
                      type="date"
                      value={formData.start_date || ""}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>שעת התחלה</Label>
                    <Input
                      type="time"
                      value={formData.start_time || ""}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>תאריך סיום *</Label>
                    <Input
                      type="date"
                      value={formData.end_date || ""}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>שעת סיום</Label>
                    <Input
                      type="time"
                      value={formData.end_time || ""}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!formData.customer_id || !formData.start_date || !formData.end_date}
                    className="w-full"
                  >
                    המשך
                    <ArrowLeft className="w-4 h-4 mr-2" />
                  </Button>
                  {selectedBooking && (
                    <Button
                      variant="outline"
                      onClick={handleSubmit}
                      disabled={updateMutation.isPending}
                      className="w-full"
                    >
                      שמור שינויים
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold">רכבים זמינים בתאריכים הנבחרים</h3>
                
                {getAvailableVehicles().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    אין רכבים זמינים בתאריכים אלו
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                    {getAvailableVehicles().map(vehicle => (
                      <Card
                        key={vehicle.id}
                        className={`p-4 cursor-pointer transition-all ${
                          formData.vehicle_id === vehicle.id 
                            ? 'border-2 border-accent bg-accent/10' 
                            : 'hover:border-accent/50'
                        }`}
                        onClick={() => setFormData({ ...formData, vehicle_id: vehicle.id })}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{vehicle.manufacturer} {vehicle.model}</p>
                            <p className="text-sm text-muted-foreground">{vehicle.license_plate} | {vehicle.vehicle_type}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-accent">₪{vehicle.daily_rate}/יום</p>
                            <p className="text-sm text-muted-foreground">₪{vehicle.monthly_rate}/חודש</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>חזרה</Button>
                    <Button 
                      onClick={() => setStep(3)}
                      disabled={!formData.vehicle_id}
                      className="flex-1"
                    >
                      המשך
                    </Button>
                  </div>
                  {selectedBooking && (
                    <Button
                      variant="outline"
                      onClick={handleSubmit}
                      disabled={updateMutation.isPending}
                      className="w-full"
                    >
                      שמור שינויים
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>עלות השכרה</Label>
                    <Input
                      type="number"
                      value={formData.rental_cost || ""}
                      onChange={(e) => setFormData({ ...formData, rental_cost: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>סכום מקדמה</Label>
                    <Input
                      type="number"
                      value={formData.deposit_amount || ""}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>מסגרת אשראי</Label>
                    <Input
                      type="number"
                      value={formData.credit_hold || ""}
                      onChange={(e) => setFormData({ ...formData, credit_hold: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>אמצעי תשלום</Label>
                    <Select 
                      value={formData.payment_method || ""} 
                      onValueChange={(v: any) => setFormData({ ...formData, payment_method: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="מזומן">מזומן</SelectItem>
                        <SelectItem value="אשראי">אשראי</SelectItem>
                        <SelectItem value="צ׳ק">צ׳ק</SelectItem>
                        <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>סטטוס תשלום</Label>
                    <Select 
                      value={formData.payment_status || "לא שולם"} 
                      onValueChange={(v: any) => setFormData({ ...formData, payment_status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="לא שולם">לא שולם</SelectItem>
                        <SelectItem value="מקדמה">מקדמה</SelectItem>
                        <SelectItem value="שולם">שולם</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>סטטוס הזמנה</Label>
                    <Select 
                      value={formData.status || "מאושר"} 
                      onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ממתין">ממתין</SelectItem>
                        <SelectItem value="מאושר">מאושר</SelectItem>
                        <SelectItem value="בוטל">בוטל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>הערות</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)}>חזרה</Button>
                    <Button 
                      onClick={handleSubmit}
                      className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {selectedBooking ? "שמור שינויים" : "יצירת הזמנה"}
                    </Button>
                  </div>
                  {selectedBooking && selectedBooking.status !== "הושלם" && selectedBooking.status !== "בוטל" && (
                    <Button
                      onClick={() => {
                        // Save first, then open rental wizard
                        handleSubmit();
                        setTimeout(() => {
                          setWizardBooking(selectedBooking);
                          setRentalWizardOpen(true);
                        }, 500);
                      }}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 ml-2" />
                      שמור והתחל השכרה
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Booking Details Dialog */}
      <Dialog open={!!viewingBooking} onOpenChange={() => setViewingBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>פרטי הזמנה</DialogTitle>
          </DialogHeader>

          {viewingBooking && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">לקוח</Label>
                  <p className="font-medium">{viewingBooking.customer_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">רכב</Label>
                  <p className="font-medium">{viewingBooking.vehicle_details}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך התחלה</Label>
                  <p className="font-medium">
                    {viewingBooking.start_date} {viewingBooking.start_time || ""}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך סיום</Label>
                  <p className="font-medium">
                    {viewingBooking.end_date} {viewingBooking.end_time || ""}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">עלות</Label>
                  <p className="font-medium text-lg">₪{viewingBooking.rental_cost?.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <StatusBadge status={viewingBooking.status} />
                </div>
              </div>

              {/* Documents Status */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">מסמכים וחתימות</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">חוזה השכרה</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {viewingBooking.contract_signed ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-600 font-medium">נחתם</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">טרם נחתם</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">תצהיר קבלת רכב</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {viewingBooking.declaration_signed ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-600 font-medium">נחתם</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">טרם נחתם</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-red-600" />
                      <span className="font-medium">כתב ויתור</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {viewingBooking.waiver_signed ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-green-600 font-medium">נחתם</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">טרם נחתם</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              {(viewingBooking.deposit_amount || viewingBooking.credit_hold) && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">תשלום</h3>
                  <div className="space-y-2">
                    {viewingBooking.deposit_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">מקדמה:</span>
                        <span className="font-medium">₪{viewingBooking.deposit_amount.toLocaleString()}</span>
                      </div>
                    )}
                    {viewingBooking.credit_hold && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">מסגרת אשראי:</span>
                        <span className="font-medium">₪{viewingBooking.credit_hold.toLocaleString()}</span>
                      </div>
                    )}
                    {viewingBooking.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">אמצעי תשלום:</span>
                        <span className="font-medium">{viewingBooking.payment_method}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewingBooking.notes && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">הערות</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{viewingBooking.notes}</p>
                </div>
              )}

              <Button onClick={() => setViewingBooking(null)} className="w-full">
                סגור
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rental Start Wizard Dialog */}
      <Dialog open={rentalWizardOpen} onOpenChange={(open) => { if (!open) { setRentalWizardOpen(false); setWizardBooking(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>התחלת השכרה</DialogTitle>
          </DialogHeader>
          {wizardBooking && (
            <RentalStartWizard
              booking={wizardBooking}
              customer={customers.find(c => c.id === wizardBooking.customer_id) || null}
              vehicle={vehicles.find(v => v.id === wizardBooking.vehicle_id) || null}
              onComplete={handleWizardComplete}
              onCancel={() => { setRentalWizardOpen(false); setWizardBooking(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
