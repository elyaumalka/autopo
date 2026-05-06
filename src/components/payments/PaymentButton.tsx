import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, History, Unlock, Trash2, Loader2 } from "lucide-react";
import { SumitPaymentDialog, type PaymentAction } from "./SumitPaymentDialog";
import { PaymentHistoryDialog } from "./PaymentHistoryDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PaymentButtonProps {
  defaultAction?: PaymentAction;
  amount?: number;
  description?: string;
  customer?: any;
  bookingId?: string;
  rentalId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  onSuccess?: (result: any) => void;
  showHistory?: boolean;
  /** Show release-authorization button (when there is an active J5 hold) */
  hasAuthorization?: boolean;
  /** Show delete-card button (when customer has a saved card) */
  hasSavedCard?: boolean;
}

export function PaymentButton({
  defaultAction = "charge",
  amount, description, customer,
  bookingId, rentalId,
  label = "סליקה",
  variant = "outline",
  size = "sm",
  className,
  onSuccess,
  showHistory = true,
  hasAuthorization = false,
  hasSavedCard = false,
}: PaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState<"release" | "delete" | null>(null);

  const handleRelease = async () => {
    setBusy("release");
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "release_authorization", customer: customer ? { id: customer.id, name: customer.name } : undefined, bookingId, rentalId },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.raw?.UserErrorMessage || "שחרור נכשל");
      toast({ title: "המסגרת שוחררה" });
      onSuccess?.(data);
    } catch (e: any) {
      toast({ title: "שגיאה בשחרור מסגרת", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "delete_card", customer: { id: customer.id, name: customer.name } },
      });
      if (error) throw error;
      toast({ title: "הכרטיס נמחק" });
      onSuccess?.(data);
    } catch (e: any) {
      toast({ title: "שגיאה במחיקת כרטיס", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <CreditCard className="w-4 h-4 ml-2" />
        {label}
      </Button>

      {hasAuthorization && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="שחרור תפיסת מסגרת" disabled={busy !== null}>
              {busy === "release" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>שחרור תפיסת מסגרת</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו תבטל את ה-J5 בסומיט ותשחרר את המסגרת בכרטיס. להמשיך?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleRelease}>שחרר</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {hasSavedCard && customer?.id && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="מחיקת כרטיס שמור" disabled={busy !== null}>
              {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת כרטיס שמור</AlertDialogTitle>
              <AlertDialogDescription>
                הטוקן של הכרטיס יוסר מהלקוח. ניתן לשמור כרטיס חדש בכל עת.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>מחק</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showHistory && (
        <Button type="button" variant="ghost" size="icon" title="היסטוריית תשלומים" onClick={() => setHistoryOpen(true)}>
          <History className="w-4 h-4" />
        </Button>
      )}

      <SumitPaymentDialog
        open={open} onOpenChange={setOpen}
        defaultAction={defaultAction}
        amount={amount} description={description}
        customer={customer} bookingId={bookingId} rentalId={rentalId}
        onSuccess={onSuccess}
      />
      <PaymentHistoryDialog
        open={historyOpen} onOpenChange={setHistoryOpen}
        customerId={customer?.id}
        bookingId={bookingId}
        rentalId={rentalId}
        title={customer?.name}
      />
    </div>
  );
}
