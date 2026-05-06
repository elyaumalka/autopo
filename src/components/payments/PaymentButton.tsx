import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, History } from "lucide-react";
import { SumitPaymentDialog, type PaymentAction } from "./SumitPaymentDialog";
import { PaymentHistoryDialog } from "./PaymentHistoryDialog";

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
}: PaymentButtonProps) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div className="inline-flex items-center gap-1">
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <CreditCard className="w-4 h-4 ml-2" />
        {label}
      </Button>
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
