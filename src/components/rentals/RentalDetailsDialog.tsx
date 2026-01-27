import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, DollarSign, Calendar, Car, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

type Rental = Tables<"rentals">;

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
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!rental) return null;

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }

    setIsUpdating(true);
    try {
      const newPaid = (rental.paid_amount || 0) + amount;
      const newRemaining = (rental.total_cost || 0) - newPaid;

      const { error } = await supabase
        .from("rentals")
        .update({
          paid_amount: newPaid,
          remaining_payment: newRemaining >= 0 ? newRemaining : 0,
        })
        .eq("id", rental.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: "התשלום נוסף בהצלחה" });
      setPaymentAmount("");
    } catch (error) {
      toast({ title: "שגיאה בהוספת תשלום", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>פרטי השכרה {rental.invoice_number}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              פרטים
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              תשלומים
            </TabsTrigger>
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
              </div>
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
                <p className="font-medium">
                  {rental.start_km?.toLocaleString() || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">ק"מ סיום</p>
                <p className="font-medium">
                  {rental.end_km?.toLocaleString() || "-"}
                </p>
              </div>
              {rental.extra_km && rental.extra_km > 0 && (
                <>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">ק"מ נוסף</p>
                    <p className="font-medium">{rental.extra_km.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">עלות ק"מ נוסף</p>
                    <p className="font-medium">
                      ₪{rental.extra_km_cost?.toLocaleString() || 0}
                    </p>
                  </div>
                </>
              )}
            </div>

            {rental.notes && (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">הערות</p>
                <p className="mt-1">{rental.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">עלות בסיס</p>
                <p className="text-2xl font-bold">
                  ₪{rental.base_cost?.toLocaleString() || 0}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">חיובים נוספים</p>
                <p className="text-2xl font-bold">
                  ₪{rental.additional_charges?.toLocaleString() || 0}
                </p>
                {rental.additional_charges_details && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rental.additional_charges_details}
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-cyan-50 p-4">
                <p className="text-sm text-cyan-700">סה"כ לתשלום</p>
                <p className="text-2xl font-bold text-cyan-700">
                  ₪{rental.total_cost?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-green-50 p-4">
                <p className="text-sm text-green-700">שולם</p>
                <p className="text-2xl font-bold text-green-700">
                  ₪{rental.paid_amount?.toLocaleString() || 0}
                </p>
              </div>
              <div
                className={`rounded-lg border p-4 ${
                  rental.remaining_payment && rental.remaining_payment > 0
                    ? "bg-red-50"
                    : "bg-green-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    rental.remaining_payment && rental.remaining_payment > 0
                      ? "text-red-700"
                      : "text-green-700"
                  }`}
                >
                  נותר לתשלום
                </p>
                <p
                  className={`text-2xl font-bold ${
                    rental.remaining_payment && rental.remaining_payment > 0
                      ? "text-red-700"
                      : "text-green-700"
                  }`}
                >
                  ₪{rental.remaining_payment?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {rental.status === "פעיל" &&
              rental.remaining_payment &&
              rental.remaining_payment > 0 && (
                <div className="rounded-lg border p-4">
                  <Label className="mb-4 block font-medium">הוספת תשלום</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="סכום"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-40"
                    />
                    <Button onClick={handleAddPayment} disabled={isUpdating}>
                      <DollarSign className="ml-2 h-4 w-4" />
                      הוסף תשלום
                    </Button>
                  </div>
                </div>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
