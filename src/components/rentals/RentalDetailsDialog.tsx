import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, DollarSign, Calendar, Car, User, ScrollText, ArrowRightLeft, Plus, Trash2, Receipt, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import DocumentsList from "@/components/shared/DocumentsList";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";

type Rental = Tables<"rentals">;
type Vehicle = Tables<"vehicles">;

interface PaymentEntry {
  id: string;
  description: string;
  amount: number;
  method: string;
}

interface RentalDetailsDialogProps {
  rental: Rental | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RentalDetailsDialog({
  rental,
  isOpen,
  onClose,
}: RentalDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showVehicleSwap, setShowVehicleSwap] = useState(false);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [swapDate, setSwapDate] = useState("");
  const [tollAmount, setTollAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceSaved, setInvoiceSaved] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  // Payment entries
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [newPayment, setNewPayment] = useState({ description: "", amount: "", method: "" });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .in("status", ["זמין"])
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Vehicle[];
    },
    enabled: isOpen && showVehicleSwap,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer-for-payment", rental?.customer_id],
    queryFn: async () => {
      if (!rental?.customer_id) return null;
      const { data } = await supabase.from("customers").select("*").eq("id", rental.customer_id).maybeSingle();
      return data;
    },
    enabled: isOpen && !!rental?.customer_id,
  });

  useEffect(() => {
    if (rental) {
      setInvoiceNumber(rental.invoice_number || "");
      setInvoiceSaved(!!rental.invoice_number);
    }
  }, [rental]);

  if (!rental) return null;

  const handleAddPayment = async () => {
    const amount = parseFloat(newPayment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }
    if (!newPayment.description) {
      toast({ title: "נא להזין מהות התשלום", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const newPaid = (rental.paid_amount || 0) + amount;
      const totalCost = rental.total_cost || rental.base_cost || 0;
      const newRemaining = totalCost - newPaid;

      const { error } = await supabase
        .from("rentals")
        .update({
          paid_amount: newPaid,
          remaining_payment: newRemaining >= 0 ? newRemaining : 0,
        })
        .eq("id", rental.id);

      if (error) throw error;

      // Record income
      await supabase.from("incomes").insert({
        customer_id: rental.customer_id,
        customer_name: rental.customer_name,
        rental_id: rental.id,
        vehicle_id: rental.vehicle_id,
        amount: amount,
        date: format(new Date(), "yyyy-MM-dd"),
        type: "השכרה",
        payment_method: newPayment.method as any || null,
        notes: newPayment.description,
      });

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      toast({ title: `תשלום ₪${amount.toLocaleString()} נוסף בהצלחה` });
      setNewPayment({ description: "", amount: "", method: "" });
    } catch (error) {
      toast({ title: "שגיאה בהוספת תשלום", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddToll = async () => {
    const amount = parseFloat(tollAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const newToll = (rental.toll_charges || 0) + amount;
      const newTotal = (rental.base_cost || 0) + (rental.additional_charges || 0) + (rental.extra_km_cost || 0) + newToll;
      const newRemaining = newTotal - (rental.paid_amount || 0);

      const { error } = await supabase
        .from("rentals")
        .update({
          toll_charges: newToll,
          total_cost: newTotal,
          remaining_payment: newRemaining >= 0 ? newRemaining : 0,
        })
        .eq("id", rental.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: `חיוב כביש 6 ₪${amount.toLocaleString()} נוסף` });
      setTollAmount("");
    } catch (error) {
      toast({ title: "שגיאה בהוספת חיוב", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVehicleSwap = async () => {
    if (!newVehicleId) {
      toast({ title: "נא לבחור רכב", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const newVehicle = vehicles.find(v => v.id === newVehicleId);
      if (!newVehicle) throw new Error("Vehicle not found");

      const vehicleDetails = `${newVehicle.manufacturer} ${newVehicle.model} - ${newVehicle.license_plate}`;
      const effectiveSwapDate = swapDate || format(new Date(), "yyyy-MM-dd");
      // תיעוד ההחלפה בהערות - התנאים (מחיר/תקופה) נשמרים לפי ההשכרה המקורית
      const swapNote = `[החלפת רכב ${effectiveSwapDate}] מ: ${rental.vehicle_details || "-"} ל: ${vehicleDetails} — התנאים נשמרים לפי ההשכרה המקורית`;
      const mergedNotes = rental.notes ? `${rental.notes}\n${swapNote}` : swapNote;

      // Update rental with new vehicle (terms/price unchanged)
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          vehicle_id: newVehicleId,
          vehicle_details: vehicleDetails,
          notes: mergedNotes,
        })
        .eq("id", rental.id);

      if (rentalError) throw rentalError;

      // Update old vehicle status to available
      if (rental.vehicle_id) {
        await supabase
          .from("vehicles")
          .update({ status: "זמין" })
          .eq("id", rental.vehicle_id);
      }

      // Update new vehicle status to rented
      await supabase
        .from("vehicles")
        .update({ status: "מושכר" })
        .eq("id", newVehicleId);

      // Update booking if exists
      if (rental.booking_id) {
        await supabase
          .from("bookings")
          .update({
            vehicle_id: newVehicleId,
            vehicle_details: vehicleDetails,
          })
          .eq("id", rental.booking_id);
      }

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "הרכב הוחלף בהצלחה" });
      setShowVehicleSwap(false);
      setNewVehicleId("");
      onClose();
    } catch (error) {
      toast({ title: "שגיאה בהחלפת רכב", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveInvoice = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("rentals")
        .update({ invoice_number: invoiceNumber || null })
        .eq("id", rental.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: "מספר חשבונית נשמר" });
      setInvoiceSaved(true);
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const totalCost = rental.total_cost || rental.base_cost || 0;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>פרטי השכרה - {rental.customer_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              פרטים
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              תשלומים
            </TabsTrigger>
            <TabsTrigger value="tolls" className="gap-1 text-xs">
              <Receipt className="h-3.5 w-3.5" />
              כביש 6
            </TabsTrigger>
            {rental.booking_id && (
              <TabsTrigger value="documents" className="gap-1 text-xs">
                <ScrollText className="h-3.5 w-3.5" />
                מסמכים
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">לקוח</p>
                  <p className="font-medium">{rental.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Car className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">רכב</p>
                  <p className="font-medium">{rental.vehicle_details}</p>
                </div>
                {rental.status === "פעיל" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mr-auto"
                    onClick={() => setShowVehicleSwap(!showVehicleSwap)}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 ml-1" />
                    החלף
                  </Button>
                )}
              </div>

              {/* Vehicle Swap */}
              {showVehicleSwap && (
                <div className="col-span-2 rounded-lg border-2 border-dashed border-primary/30 p-4 space-y-3">
                  <Label>החלפה לרכב חילופי</Label>
                  <Select value={newVehicleId} onValueChange={setNewVehicleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר רכב זמין" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.manufacturer} {v.model} - {v.license_plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <Label className="text-xs">תאריך ההחלפה</Label>
                    <Input type="date" value={swapDate} onChange={(e) => setSwapDate(e.target.value)} placeholder="ברירת מחדל: היום" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    מזמן ההחלפה הרכב החדש מופיע על ההשכרה. כל התנאים (מחיר, תקופה) נשמרים לפי ההשכרה המקורית.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleVehicleSwap} disabled={isUpdating} size="sm">
                      <ArrowRightLeft className="h-3.5 w-3.5 ml-1" />
                      אשר החלפה
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowVehicleSwap(false)}>
                      ביטול
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">תאריך התחלה</p>
                  <p className="font-medium">
                    {rental.start_date
                      ? format(new Date(rental.start_date), "dd/MM/yyyy")
                      : "-"}
                    {rental.start_time && ` ${rental.start_time}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">תאריך סיום</p>
                  <p className="font-medium">
                    {rental.actual_end_date
                      ? format(new Date(rental.actual_end_date), "dd/MM/yyyy")
                      : rental.planned_end_date
                      ? `${format(new Date(rental.planned_end_date), "dd/MM/yyyy")} (משוער)`
                      : "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">ק"מ התחלה</p>
                <p className="font-medium">{rental.start_km?.toLocaleString() || "-"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">ק"מ סיום</p>
                <p className="font-medium">{rental.end_km?.toLocaleString() || "-"}</p>
              </div>
              {rental.billing_rate_type && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">סוג תעריף</p>
                  <p className="font-medium">{rental.billing_rate_type}</p>
                </div>
              )}
              {rental.billing_rate_amount && (
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">תעריף</p>
                  <p className="font-medium">₪{rental.billing_rate_amount?.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Invoice */}
            <div className="rounded-lg border p-4 flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">מספר חשבונית</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => { setInvoiceNumber(e.target.value); setInvoiceSaved(false); }}
                    placeholder="הזן מספר חשבונית"
                    className="h-9"
                  />
                  <Button size="sm" onClick={handleSaveInvoice} disabled={isUpdating || invoiceSaved}>
                    {invoiceSaved ? "✓" : "שמור"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-cyan-700 border-cyan-300 hover:bg-cyan-50 shrink-0" onClick={() => setInvoiceDialogOpen(true)}>
                    <Receipt className="h-4 w-4 ml-1" /> הפק חשבונית
                  </Button>
                </div>
                {invoiceNumber && (
                  <p className="text-xs text-green-600 mt-1">✓ הופקה חשבונית ({invoiceNumber})</p>
                )}
              </div>
            </div>

            {rental.notes && (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">הערות</p>
                <p className="mt-1">{rental.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            {/* Cost summary */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">עלות בסיס</p>
                <p className="text-2xl font-bold">₪{rental.base_cost?.toLocaleString() || 0}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">חיובים נוספים</p>
                <p className="text-2xl font-bold">₪{rental.additional_charges?.toLocaleString() || 0}</p>
                {rental.additional_charges_details && (
                  <p className="mt-1 text-sm text-muted-foreground">{rental.additional_charges_details}</p>
                )}
              </div>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">כביש 6</p>
                <p className="text-2xl font-bold">₪{rental.toll_charges?.toLocaleString() || 0}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-accent/30 p-4">
                <p className="text-sm font-medium">סה"כ לתשלום</p>
                <p className="text-2xl font-bold">₪{totalCost.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-sm text-green-700">שולם</p>
                <p className="text-2xl font-bold text-green-700">₪{rental.paid_amount?.toLocaleString() || 0}</p>
              </div>
              <div className={`rounded-lg border p-4 ${rental.remaining_payment && rental.remaining_payment > 0 ? "bg-red-50" : "bg-green-50"}`}>
                <p className={`text-sm ${rental.remaining_payment && rental.remaining_payment > 0 ? "text-red-700" : "text-green-700"}`}>נותר</p>
                <p className={`text-2xl font-bold ${rental.remaining_payment && rental.remaining_payment > 0 ? "text-red-700" : "text-green-700"}`}>
                  ₪{rental.remaining_payment?.toLocaleString() || 0}
                </p>
            </div>

            {/* Sumit payment actions */}
            <div className="rounded-lg border bg-cyan-50/50 p-4 space-y-2">
              <Label className="font-medium">סליקה דרך SUMIT</Label>
              {/* חיווי תפיסת מסגרת אשראי */}
              {(rental as any).sumit_auth_number ? (
                <div className="flex items-center gap-2 rounded-md bg-green-100 text-green-800 px-3 py-2 text-sm">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>
                    מסגרת נתפסה{(rental as any).sumit_authorized_amount ? ` (₪${Number((rental as any).sumit_authorized_amount).toLocaleString()})` : ""}
                    {(rental as any).sumit_auth_number ? ` · אישור ${(rental as any).sumit_auth_number}` : ""}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-orange-100 text-orange-800 px-3 py-2 text-sm">
                  <span className="font-medium">⚠ טרם נתפסה מסגרת אשראי</span>
                  {rental.credit_hold ? <span className="text-orange-700">(נדרש: ₪{Number(rental.credit_hold).toLocaleString()})</span> : null}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <PaymentButton
                  defaultAction="charge"
                  label="חיוב באשראי"
                  amount={rental.remaining_payment || 0}
                  description={`השכרה - ${rental.vehicle_details || ''}`}
                  customer={customer ? {
                    id: customer.id,
                    name: `${customer.first_name} ${customer.last_name}`,
                    phone: customer.phone, email: customer.email,
                    address: customer.address, city: customer.city,
                    citizenId: customer.id_number,
                    payment_token: customer.payment_token,
                    card_last4: customer.card_last4,
                    card_expiry: (customer as any).card_expiry,
                  } : { name: rental.customer_name || '' }}
                  rentalId={rental.id}
                  onSuccess={async (result: any) => {
                    // אחרי חיוב מוצלח - מעדכנים את הסכום ששולם והיתרה בהשכרה
                    if (result?.action === "charge") {
                      const charged = Number(result?.amount || 0);
                      if (charged > 0) {
                        const newPaid = Number(rental.paid_amount || 0) + charged;
                        const newRemaining = Math.max(0, Number(totalCost || 0) - newPaid);
                        await supabase.from("rentals").update({ paid_amount: newPaid, remaining_payment: newRemaining } as any).eq("id", rental.id);
                        if (newRemaining <= 0) {
                          await supabase.from("collection_tasks").update({ status: "נסגר" } as any).eq("rental_id", rental.id).in("status", ["פתוח", "בטיפול", "חלקי"]);
                        }
                      }
                    }
                    queryClient.invalidateQueries({ queryKey: ["rentals"] });
                    queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
                    queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });
                  }}
                />
                <PaymentButton
                  defaultAction="authorize"
                  label="תפיסת מסגרת J5"
                  amount={rental.credit_hold || 0}
                  description="תפיסת מסגרת"
                  customer={customer ? {
                    id: customer.id,
                    name: `${customer.first_name} ${customer.last_name}`,
                    phone: customer.phone, email: customer.email,
                    citizenId: customer.id_number,
                    payment_token: customer.payment_token,
                    card_last4: customer.card_last4,
                    card_expiry: (customer as any).card_expiry,
                  } : { name: rental.customer_name || '' }}
                  rentalId={rental.id}
                  hasAuthorization={!!(rental as any).sumit_auth_number}
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ["rentals"] })}
                />
              </div>
            </div>
            </div>

            {/* Add payment */}
            <div className="rounded-lg border p-4 space-y-3">
              <Label className="font-medium">הוספת תשלום</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">מהות</Label>
                  <Input
                    placeholder="השכרה, מקדמה..."
                    value={newPayment.description}
                    onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">סכום (₪)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">אמצעי</Label>
                  <Select value={newPayment.method} onValueChange={(v) => setNewPayment({ ...newPayment, method: v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="בחר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="מזומן">מזומן</SelectItem>
                      <SelectItem value="אשראי">אשראי</SelectItem>
                      <SelectItem value="ביט">ביט</SelectItem>
                      <SelectItem value="העברה בנקאית">העברה</SelectItem>
                      <SelectItem value="צ׳ק">צ׳ק</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddPayment} disabled={isUpdating} size="sm">
                <Plus className="h-3.5 w-3.5 ml-1" />
                הוסף תשלום
              </Button>
            </div>
          </TabsContent>

          {/* Toll charges tab */}
          <TabsContent value="tolls" className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">סה"כ חיובי כביש 6</p>
              <p className="text-3xl font-bold">₪{rental.toll_charges?.toLocaleString() || 0}</p>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <Label className="font-medium">הוספת חיוב כביש 6</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="סכום (₪)"
                  value={tollAmount}
                  onChange={(e) => setTollAmount(e.target.value)}
                  className="w-40"
                />
                <Button onClick={handleAddToll} disabled={isUpdating}>
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  הוסף חיוב
                </Button>
              </div>
            </div>
          </TabsContent>

          {rental.booking_id && (
            <TabsContent value="documents" className="space-y-4">
              <DocumentsList
                bookingId={rental.booking_id}
                customerName={rental.customer_name}
                showActions={rental.status === "פעיל"}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* הפקת חשבונית (סעיף 28) */}
    <InvoiceDialog
      open={invoiceDialogOpen}
      onOpenChange={setInvoiceDialogOpen}
      rentalId={rental.id}
      defaultCustomerName={rental.customer_name || ""}
      defaultAmount={totalCost}
      defaultVehicleDetails={rental.vehicle_details || ""}
      defaultPeriod={`${rental.start_date || ""} - ${rental.actual_end_date || rental.planned_end_date || ""}`}
      onIssued={(num) => { setInvoiceNumber(num); setInvoiceSaved(true); }}
    />
    </>
  );
}
