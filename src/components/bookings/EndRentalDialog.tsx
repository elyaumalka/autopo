import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, XCircle } from "lucide-react";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Rental = Database["public"]["Tables"]["rentals"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

interface EndRentalDialogProps {
  isOpen: boolean;
  booking: Booking | null;
  rental: Rental | null;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function EndRentalDialog({
  isOpen,
  booking,
  rental,
  vehicle,
  onClose,
  onSaved,
}: EndRentalDialogProps) {
  const queryClient = useQueryClient();
  const [endData, setEndData] = useState({
    actual_end_date: "",
    actual_end_time: "",
    end_km: 0,
    additional_charges: 0,
    additional_charges_details: "",
    payment_amount: 0,
    payment_method: "" as string,
    collection_date: "",
    invoice_number: "",
    notes: "",
  });

  useEffect(() => {
    if (!isOpen || !booking) return;

    const now = new Date();
    setEndData({
      actual_end_date: rental?.actual_end_date || format(now, "yyyy-MM-dd"),
      actual_end_time: rental?.actual_end_time?.slice(0, 5) || format(now, "HH:mm"),
      end_km: Number(rental?.end_km ?? vehicle?.current_km ?? rental?.start_km ?? 0),
      additional_charges: Number(rental?.additional_charges ?? 0),
      additional_charges_details: rental?.additional_charges_details || "",
      payment_amount: 0,
      payment_method: booking.payment_method || "",
      collection_date: "",
      invoice_number: rental?.invoice_number || "",
      notes: rental?.notes || booking.notes || "",
    });
  }, [isOpen, booking, rental, vehicle]);

  const costs = useMemo(() => {
    const baseCost = Number(rental?.base_cost ?? booking?.rental_cost ?? 0);
    const startKm = Number(rental?.start_km ?? 0);
    const kmLimit = Number(vehicle?.km_limit ?? 0);
    const extraKmPrice = Number(vehicle?.extra_km_price ?? 0);
    const endKm = Number(endData.end_km || 0);

    const extraKm = Math.max(0, endKm - startKm - kmLimit);
    const extraKmCost = extraKm * extraKmPrice;
    const additional = Number(endData.additional_charges || 0);
    const totalCost = baseCost + extraKmCost + additional;

    const alreadyPaid = Number(rental?.paid_amount ?? booking?.deposit_amount ?? 0);
    const totalPaid = alreadyPaid + Number(endData.payment_amount || 0);
    const remaining = totalCost - totalPaid;

    return {
      baseCost,
      extraKm,
      extraKmCost,
      totalCost,
      alreadyPaid,
      totalPaid,
      remaining,
    };
  }, [booking, rental, vehicle, endData.end_km, endData.additional_charges, endData.payment_amount]);

  const endMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("לא נמצאה הזמנה");

      const paidNow = Number(endData.payment_amount || 0);
      const safeRemaining = Math.max(0, costs.remaining);
      const finalNotes = endData.notes?.trim() || null;

      // Update rental (if exists)
      if (rental) {
        const { error: rentalError } = await supabase
          .from("rentals")
          .update({
            actual_end_date: endData.actual_end_date || null,
            actual_end_time: endData.actual_end_time || null,
            end_km: endData.end_km,
            extra_km: costs.extraKm,
            extra_km_cost: costs.extraKmCost,
            additional_charges: Number(endData.additional_charges || 0),
            additional_charges_details: endData.additional_charges_details || null,
            total_cost: costs.totalCost,
            paid_amount: costs.totalPaid,
            remaining_payment: safeRemaining,
            invoice_number: endData.invoice_number || null,
            notes: finalNotes,
            status: "הושלם",
          } as any)
          .eq("id", rental.id);

        if (rentalError) throw rentalError;
      }

      // Update booking to completed and sync actual end values
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "הושלם",
          end_date: endData.actual_end_date || booking.end_date,
          end_time: endData.actual_end_time || booking.end_time,
          payment_method: endData.payment_method || booking.payment_method,
          notes: finalNotes,
        } as any)
        .eq("id", booking.id);

      if (bookingError) throw bookingError;

      // Vehicle release
      if (booking.vehicle_id) {
        await supabase
          .from("vehicles")
          .update({
            status: "זמין",
            current_km: endData.end_km || vehicle?.current_km,
          } as any)
          .eq("id", booking.vehicle_id);
      }

      // Payment record
      if (paidNow > 0) {
        const { error: incomeError } = await supabase.from("incomes").insert({
          customer_id: booking.customer_id,
          customer_name: booking.customer_name,
          rental_id: rental?.id || null,
          vehicle_id: booking.vehicle_id,
          amount: paidNow,
          date: endData.actual_end_date || format(new Date(), "yyyy-MM-dd"),
          type: "השכרה",
          payment_method: endData.payment_method || null,
          invoice_number: endData.invoice_number || null,
          notes: "תשלום בסיום השכרה",
        } as any);
        if (incomeError) throw incomeError;
      }

      if (rental) {
        if (safeRemaining > 0) {
          const { data: existingOpenTasks } = await supabase
            .from("collection_tasks")
            .select("id")
            .eq("rental_id", rental.id)
            .in("status", ["פתוח", "בטיפול", "חלקי"]);

          if (existingOpenTasks && existingOpenTasks.length > 0) {
            await supabase
              .from("collection_tasks")
              .update({
                amount: safeRemaining,
                payment_due_date: endData.collection_date || null,
                notes: endData.additional_charges_details || null,
                status: safeRemaining > 0 ? "פתוח" : "נסגר",
              } as any)
              .eq("id", existingOpenTasks[0].id);
          } else {
            await supabase.from("collection_tasks").insert({
              customer_id: booking.customer_id,
              customer_name: booking.customer_name,
              rental_id: rental.id,
              vehicle_id: booking.vehicle_id,
              vehicle_details: booking.vehicle_details,
              debt_date: endData.actual_end_date || format(new Date(), "yyyy-MM-dd"),
              amount: safeRemaining,
              reason: "יתרת תשלום השכרה",
              status: "פתוח",
              payment_due_date: endData.collection_date || null,
              notes: endData.additional_charges_details || null,
            } as any);
          }
        } else {
          await supabase
            .from("collection_tasks")
            .update({ status: "נסגר" } as any)
            .eq("rental_id", rental.id)
            .in("status", ["פתוח", "בטיפול", "חלקי"]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-all"] });
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });

      toast({ title: "השכרה עודכנה בהצלחה" });
      onClose();
      onSaved?.();
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בסיום/עדכון השכרה",
        description: error?.message || "נסה שוב",
        variant: "destructive",
      });
    },
  });

  if (!booking) return null;

  const isCompleted = rental?.status === "הושלם" || booking.status === "הושלם";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCompleted ? "עדכון השכרה שהושלמה" : "סיום השכרה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{booking.customer_name}</p>
            <p className="text-sm text-muted-foreground">{booking.vehicle_details}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תאריך החזרה</Label>
              <Input
                type="date"
                value={endData.actual_end_date}
                onChange={(e) => setEndData((prev) => ({ ...prev, actual_end_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>שעת החזרה</Label>
              <Input
                type="time"
                value={endData.actual_end_time}
                onChange={(e) => setEndData((prev) => ({ ...prev, actual_end_time: e.target.value }))}
              />
            </div>
            <div>
              <Label>ק"מ סיום</Label>
              <Input
                type="number"
                value={endData.end_km}
                onChange={(e) =>
                  setEndData((prev) => ({ ...prev, end_km: parseInt(e.target.value || "0", 10) || 0 }))
                }
              />
            </div>
            <div>
              <Label>חיובים נוספים</Label>
              <Input
                type="number"
                value={endData.additional_charges}
                onChange={(e) =>
                  setEndData((prev) => ({
                    ...prev,
                    additional_charges: parseFloat(e.target.value || "0") || 0,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <Label>פירוט חיובים</Label>
            <Textarea
              placeholder="כביש 6 / דלק / תיקון..."
              value={endData.additional_charges_details}
              onChange={(e) =>
                setEndData((prev) => ({ ...prev, additional_charges_details: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תשלום עכשיו (₪)</Label>
              <Input
                type="number"
                value={endData.payment_amount}
                onChange={(e) =>
                  setEndData((prev) => ({
                    ...prev,
                    payment_amount: parseFloat(e.target.value || "0") || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label>אמצעי תשלום</Label>
              <Select
                value={endData.payment_method}
                onValueChange={(v) => setEndData((prev) => ({ ...prev, payment_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר אמצעי תשלום" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="מזומן">מזומן</SelectItem>
                  <SelectItem value="אשראי">אשראי</SelectItem>
                  <SelectItem value="ביט">ביט</SelectItem>
                  <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                  <SelectItem value="צ׳ק">צ׳ק</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>מספר חשבונית</Label>
            <Input
              placeholder="אופציונלי"
              value={endData.invoice_number}
              onChange={(e) => setEndData((prev) => ({ ...prev, invoice_number: e.target.value }))}
            />
          </div>

          {costs.remaining > 0 && (
            <div>
              <Label>תאריך גבייה ליתרה</Label>
              <Input
                type="date"
                value={endData.collection_date}
                onChange={(e) => setEndData((prev) => ({ ...prev, collection_date: e.target.value }))}
              />
            </div>
          )}

          <div>
            <Label>הערות</Label>
            <Textarea
              value={endData.notes}
              onChange={(e) => setEndData((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span>עלות בסיס:</span>
              <span>₪{costs.baseCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>ק"מ נוסף ({costs.extraKm}):</span>
              <span>₪{costs.extraKmCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>חיובים נוספים:</span>
              <span>₪{Number(endData.additional_charges || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>סה"כ:</span>
              <span>₪{costs.totalCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>שולם קודם:</span>
              <span>₪{costs.alreadyPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>שולם כולל עכשיו:</span>
              <span>₪{costs.totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>נותר לתשלום:</span>
              <span>₪{Math.max(0, costs.remaining).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => endMutation.mutate()}
              className="flex-1"
              disabled={endMutation.isPending || !endData.actual_end_date}
            >
              <Check className="w-4 h-4 ml-2" />
              {endMutation.isPending ? "שומר..." : isCompleted ? "שמירה ועדכון חיוב" : "סיום + חיוב"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              <XCircle className="w-4 h-4 ml-1" />
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
