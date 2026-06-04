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
import { calculateRentalCost, getRateForType, type RentalRateType } from "@/lib/rentalCalculations";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { useQuery } from "@tanstack/react-query";

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
  const { data: customer } = useQuery({
    queryKey: ["customer-end-rental", booking?.customer_id],
    queryFn: async () => {
      if (!booking?.customer_id) return null;
      const { data } = await supabase.from("customers").select("*").eq("id", booking.customer_id).maybeSingle();
      return data;
    },
    enabled: isOpen && !!booking?.customer_id,
  });
  const [endData, setEndData] = useState({
    actual_end_date: "",
    actual_end_time: "",
    end_km: 0,
    rental_type: "" as string,
    rate_per_unit: 0,
    toll_charges: 0,
    additional_charges: 0,
    additional_charges_details: "",
    discount_amount: 0,
    discount_reason: "",
    override_total: false,
    final_total: 0,
    payment_amount: 0,
    payment_method: "" as string,
    collection_date: "",
    invoice_number: "",
    notes: "",
  });

  useEffect(() => {
    if (!isOpen || !booking) return;

    const now = new Date();
    const rentalType = (rental as any)?.rental_type || booking.rental_type || "";
    const ratePerUnit = (rental as any)?.rate_per_unit || Number(booking.rental_cost ?? 0);

    setEndData({
      actual_end_date: rental?.actual_end_date || format(now, "yyyy-MM-dd"),
      actual_end_time: rental?.actual_end_time?.slice(0, 5) || format(now, "HH:mm"),
      end_km: Number(rental?.end_km ?? vehicle?.current_km ?? rental?.start_km ?? 0),
      rental_type: rentalType,
      rate_per_unit: ratePerUnit,
      toll_charges: Number((rental as any)?.toll_charges ?? 0),
      additional_charges: Number(rental?.additional_charges ?? 0),
      additional_charges_details: rental?.additional_charges_details || "",
      discount_amount: 0,
      discount_reason: "",
      override_total: false,
      final_total: 0,
      payment_amount: 0,
      payment_method: booking.payment_method || "",
      collection_date: "",
      invoice_number: rental?.invoice_number || "",
      notes: rental?.notes || booking.notes || "",
    });
  }, [isOpen, booking, rental, vehicle]);

  const costs = useMemo(() => {
    const startDate = booking?.start_date || rental?.start_date || "";
    const startTime = booking?.start_time?.toString() || rental?.start_time?.toString() || "";
    const rateType = endData.rental_type as RentalRateType;
    const ratePerUnit = endData.rate_per_unit;

    // Auto-calculate base cost if we have rate type
    let baseCost: number;
    let delayHours = 0;
    let delayCost = 0;
    let breakdown = "";

    if (rateType && ratePerUnit && startDate && endData.actual_end_date) {
      const calc = calculateRentalCost({
        rateType,
        ratePerUnit,
        startDate,
        startTime: startTime || null,
        endDate: endData.actual_end_date,
        endTime: endData.actual_end_time || null,
        hourlyDelayRate: Number(vehicle?.hourly_delay_rate ?? 0),
      });
      baseCost = calc.baseCost;
      delayHours = calc.delayHours;
      delayCost = calc.delayCost;
      breakdown = calc.breakdown;
    } else {
      baseCost = Number(rental?.base_cost ?? booking?.rental_cost ?? 0);
    }

    const startKm = Number(rental?.start_km ?? 0);
    const kmLimit = Number(vehicle?.km_limit ?? 0);
    const extraKmPrice = Number(vehicle?.extra_km_price ?? 0);
    const endKm = Number(endData.end_km || 0);

    const totalKmDriven = Math.max(0, endKm - startKm);
    const extraKm = kmLimit > 0 ? Math.max(0, totalKmDriven - kmLimit) : 0;
    const extraKmCost = extraKm * extraKmPrice;

    const tollCharges = Number(endData.toll_charges || 0);
    const additional = Number(endData.additional_charges || 0);
    const subtotal = baseCost + delayCost + extraKmCost + tollCharges + additional;

    const discount = Math.max(0, Number(endData.discount_amount || 0));
    const afterDiscount = Math.max(0, subtotal - discount);

    // אם המשתמש בחר לדרוס מחיר סופי - השתמש בו במקום בחישוב
    const totalCost = endData.override_total
      ? Math.max(0, Number(endData.final_total || 0))
      : afterDiscount;

    const alreadyPaid = Number(rental?.paid_amount ?? booking?.deposit_amount ?? 0);
    const totalPaid = alreadyPaid + Number(endData.payment_amount || 0);
    const remaining = totalCost - totalPaid;

    return {
      baseCost,
      delayHours,
      delayCost,
      breakdown,
      extraKm,
      extraKmCost,
      tollCharges,
      subtotal,
      discount,
      totalCost,
      alreadyPaid,
      totalPaid,
      remaining,
    };
  }, [booking, rental, vehicle, endData]);

  const endMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error("לא נמצאה הזמנה");

      const paidNow = Number(endData.payment_amount || 0);
      const safeRemaining = Math.max(0, costs.remaining);
      const noteParts: string[] = [];
      if (endData.notes?.trim()) noteParts.push(endData.notes.trim());
      if (costs.discount > 0) {
        noteParts.push(`הנחה: ₪${costs.discount.toLocaleString()}${endData.discount_reason ? ` (${endData.discount_reason})` : ""}`);
      }
      if (endData.override_total) {
        noteParts.push(`מחיר סופי נקבע ידנית: ₪${costs.totalCost.toLocaleString()}`);
      }
      const finalNotes = noteParts.length > 0 ? noteParts.join(" | ") : null;

      if (rental) {
        const { error: rentalError } = await supabase
          .from("rentals")
          .update({
            actual_end_date: endData.actual_end_date || null,
            actual_end_time: endData.actual_end_time || null,
            end_km: endData.end_km,
            extra_km: costs.extraKm,
            extra_km_cost: costs.extraKmCost,
            base_cost: costs.baseCost,
            additional_charges: Number(endData.additional_charges || 0),
            additional_charges_details: endData.additional_charges_details || null,
            total_cost: costs.totalCost,
            paid_amount: costs.totalPaid,
            remaining_payment: safeRemaining,
            invoice_number: endData.invoice_number || null,
            notes: finalNotes,
            status: "הושלם",
            rental_type: endData.rental_type || null,
            rate_per_unit: endData.rate_per_unit || null,
            toll_charges: endData.toll_charges || 0,
          } as any)
          .eq("id", rental.id);

        if (rentalError) throw rentalError;
      }

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

      if (booking.vehicle_id) {
        await supabase
          .from("vehicles")
          .update({
            status: "זמין",
            current_km: endData.end_km || vehicle?.current_km,
          } as any)
          .eq("id", booking.vehicle_id);
      }

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCompleted ? "עדכון השכרה שהושלמה" : "סיום השכרה"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="font-medium">{booking.customer_name}</p>
            <p className="text-sm text-muted-foreground">{booking.vehicle_details}</p>
          </div>

          {/* Dates */}
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
          </div>

          {/* Rate Type & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>סוג תעריף</Label>
              <Select
                value={endData.rental_type}
                onValueChange={(v) => {
                  const rate = vehicle ? getRateForType(vehicle as any, v as RentalRateType) : endData.rate_per_unit;
                  setEndData((prev) => ({ ...prev, rental_type: v, rate_per_unit: rate || prev.rate_per_unit }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="בחר סוג תעריף" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="חצי יום">חצי יום</SelectItem>
                  <SelectItem value="24 שעות">24 שעות</SelectItem>
                  <SelectItem value="שבוע">שבוע</SelectItem>
                  <SelectItem value="חודש">חודש</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תעריף ליחידה (₪)</Label>
              <Input
                type="number"
                value={endData.rate_per_unit || ""}
                onChange={(e) =>
                  setEndData((prev) => ({ ...prev, rate_per_unit: parseFloat(e.target.value || "0") || 0 }))
                }
              />
            </div>
          </div>

          {/* KM */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ק"מ התחלה</Label>
              <Input
                type="number"
                value={rental?.start_km || 0}
                disabled
                className="bg-muted"
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
          </div>

          {/* Toll + Additional Charges */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>כבישי אגרה / כביש 6 (₪)</Label>
              <Input
                type="number"
                value={endData.toll_charges || ""}
                onChange={(e) =>
                  setEndData((prev) => ({
                    ...prev,
                    toll_charges: parseFloat(e.target.value || "0") || 0,
                  }))
                }
              />
            </div>
            <div>
              <Label>חיובים נוספים (₪)</Label>
              <Input
                type="number"
                value={endData.additional_charges || ""}
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
            <Label>פירוט חיובים נוספים</Label>
            <Textarea
              placeholder="תיאור החיובים הנוספים..."
              value={endData.additional_charges_details}
              onChange={(e) =>
                setEndData((prev) => ({ ...prev, additional_charges_details: e.target.value }))
              }
            />
          </div>

          {/* Discount & Final price override */}
          <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>הנחה (₪)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={endData.discount_amount || ""}
                  onChange={(e) =>
                    setEndData((prev) => ({
                      ...prev,
                      discount_amount: parseFloat(e.target.value || "0") || 0,
                    }))
                  }
                />
              </div>
              <div>
                <Label>סיבת ההנחה</Label>
                <Input
                  placeholder="אופציונלי"
                  value={endData.discount_reason}
                  onChange={(e) =>
                    setEndData((prev) => ({ ...prev, discount_reason: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="override_total"
                type="checkbox"
                className="h-4 w-4"
                checked={endData.override_total}
                onChange={(e) =>
                  setEndData((prev) => ({
                    ...prev,
                    override_total: e.target.checked,
                    final_total: e.target.checked
                      ? prev.final_total || Math.max(0, costs.subtotal - (prev.discount_amount || 0))
                      : 0,
                  }))
                }
              />
              <Label htmlFor="override_total" className="cursor-pointer">
                קבע מחיר סופי ידני (דריסת החישוב)
              </Label>
            </div>

            {endData.override_total && (
              <div>
                <Label>מחיר סופי לכל ההשכרה (₪)</Label>
                <Input
                  type="number"
                  value={endData.final_total || ""}
                  onChange={(e) =>
                    setEndData((prev) => ({
                      ...prev,
                      final_total: parseFloat(e.target.value || "0") || 0,
                    }))
                  }
                />
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תשלום עכשיו (₪)</Label>
              <Input
                type="number"
                value={endData.payment_amount || ""}
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

          {/* Cost Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span>עלות בסיס:</span>
              <span>₪{costs.baseCost.toLocaleString()}</span>
            </div>
            {costs.breakdown && (
              <div className="text-xs text-muted-foreground pr-2">{costs.breakdown}</div>
            )}
            {costs.delayHours > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>חיוב איחור ({costs.delayHours} שעות):</span>
                <span>₪{costs.delayCost.toLocaleString()}</span>
              </div>
            )}
            {costs.extraKm > 0 && (
              <div className="flex justify-between">
                <span>ק"מ נוסף ({costs.extraKm.toLocaleString()}):</span>
                <span>₪{costs.extraKmCost.toLocaleString()}</span>
              </div>
            )}
            {costs.tollCharges > 0 && (
              <div className="flex justify-between">
                <span>כבישי אגרה:</span>
                <span>₪{costs.tollCharges.toLocaleString()}</span>
              </div>
            )}
            {Number(endData.additional_charges || 0) > 0 && (
              <div className="flex justify-between">
                <span>חיובים נוספים:</span>
                <span>₪{Number(endData.additional_charges).toLocaleString()}</span>
              </div>
            )}
            {(costs.discount > 0 || endData.override_total) && (
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>סכום ביניים:</span>
                <span>₪{costs.subtotal.toLocaleString()}</span>
              </div>
            )}
            {costs.discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>הנחה{endData.discount_reason ? ` (${endData.discount_reason})` : ""}:</span>
                <span>- ₪{costs.discount.toLocaleString()}</span>
              </div>
            )}
            {endData.override_total && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>* מחיר סופי הוגדר ידנית</span>
                <span></span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t">
              <span>סה"כ סופי:</span>
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
            <div className={`flex justify-between font-semibold ${costs.remaining > 0 ? "text-red-600" : "text-green-600"}`}>
              <span>נותר לתשלום:</span>
              <span>₪{Math.max(0, costs.remaining).toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-lg border bg-cyan-50/50 p-3 space-y-2">
            <Label className="text-xs font-medium">סליקה דרך SUMIT</Label>
            <div className="flex flex-wrap gap-2">
              <PaymentButton
                defaultAction="charge"
                label={`חיוב נותר (₪${Math.max(0, costs.remaining).toLocaleString()})`}
                amount={Math.max(0, costs.remaining)}
                description={`סיום השכרה - ${booking?.vehicle_details || ''}`}
                customer={customer ? {
                  id: customer.id,
                  name: `${customer.first_name} ${customer.last_name}`,
                  phone: customer.phone, email: customer.email || undefined,
                  address: customer.address || undefined, city: customer.city || undefined,
                  citizenId: customer.id_number,
                  payment_token: (customer as any).payment_token,
                  card_last4: (customer as any).card_last4,
                } : { name: booking?.customer_name || '' }}
                bookingId={booking?.id}
                rentalId={rental?.id}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => endMutation.mutate()}
              className="flex-1"
              disabled={endMutation.isPending || !endData.actual_end_date}
            >
              <Check className="w-4 h-4 ml-2" />
              {endMutation.isPending ? "שומר..." : isCompleted ? "שמירה" : "סיום"}
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
