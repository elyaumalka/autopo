import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { SumitPaymentDialog, type PaymentAction } from "./SumitPaymentDialog";

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
}: PaymentButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <CreditCard className="w-4 h-4 ml-2" />
        {label}
      </Button>
      <SumitPaymentDialog
        open={open} onOpenChange={setOpen}
        defaultAction={defaultAction}
        amount={amount} description={description}
        customer={customer} bookingId={bookingId} rentalId={rentalId}
        onSuccess={onSuccess}
      />
    </>
  );
}
