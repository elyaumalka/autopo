import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Lock, Receipt } from "lucide-react";

export type PaymentAction = "authorize" | "charge" | "save_token";

interface SumitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAction?: PaymentAction;
  amount?: number;
  description?: string;
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    citizenId?: string;
    payment_token?: string | null;
    card_last4?: string | null;
    card_expiry?: string | null;
  };
  bookingId?: string;
  rentalId?: string;
  onSuccess?: (result: any) => void;
}

const actionLabels: Record<PaymentAction, { title: string; button: string; icon: any }> = {
  authorize: { title: "תפיסת מסגרת אשראי (J5)", button: "תפוס מסגרת", icon: Lock },
  charge: { title: "חיוב באשראי", button: "חייב עכשיו", icon: CreditCard },
  save_token: { title: "שמירת אמצעי תשלום", button: "שמור כרטיס", icon: Receipt },
};

export function SumitPaymentDialog({
  open, onOpenChange, defaultAction = "charge",
  amount: initialAmount, description, customer,
  bookingId, rentalId, onSuccess,
}: SumitPaymentDialogProps) {
  const [action, setAction] = useState<PaymentAction>(defaultAction);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(initialAmount?.toString() || "");
  const [payments, setPayments] = useState("1");
  const [useToken, setUseToken] = useState(!!customer?.payment_token);
  const [declineError, setDeclineError] = useState<string | null>(null);

  // סנכרון הסכום עם הסכום הנותר לתשלום בכל פעם שהחלון נפתח / הסכום משתנה
  useEffect(() => {
    if (open) {
      setAmount(initialAmount != null ? String(initialAmount) : "");
      setAction(defaultAction);
      setUseToken(!!customer?.payment_token);
      setDeclineError(null);
    }
  }, [open, initialAmount, defaultAction, customer?.payment_token]);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [citizenId, setCitizenId] = useState(customer?.citizenId || "");

  const meta = actionLabels[action];
  const Icon = meta.icon;
  const requiresAmount = action !== "save_token";

  const handleSubmit = async () => {
    if (requiresAmount && (!amount || parseFloat(amount) <= 0)) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }
    if (!useToken && (!cardNumber || !expMonth || !expYear || !cvv)) {
      toast({ title: "נא למלא את פרטי האשראי", variant: "destructive" });
      return;
    }

    setLoading(true);
    setDeclineError(null);
    try {
      let card: any;
      if (useToken && customer?.payment_token) {
        const exp = (customer as any).card_expiry as string | undefined;
        const [em, ey] = exp ? exp.split("/").map((s) => parseInt(s.trim())) : [undefined, undefined];
        card = { token: customer.payment_token, expMonth: em, expYear: ey };
      } else {
        card = {
          number: cardNumber.replace(/\s/g, ""),
          expMonth: parseInt(expMonth),
          expYear: parseInt(expYear),
          cvv,
          citizenId: citizenId || customer?.citizenId,
        };
      }

      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: {
          action,
          amount: requiresAmount ? parseFloat(amount) : undefined,
          payments: parseInt(payments) || 1,
          description: description || "השכרת רכב",
          customer: customer ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            city: customer.city,
            citizenId: citizenId || customer.citizenId,
          } : undefined,
          card,
          bookingId,
          rentalId,
          sendInvoiceEmail: true,
        },
      });

      if (error) {
        // הפונקציה החזירה שגיאה (non-2xx) - מחלצים את סיבת הסירוב האמיתית מסומיט
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          detail = body?.declineReason
            || body?.error
            || body?.raw?.Data?.Payment?.StatusDescription
            || body?.raw?.UserErrorMessage
            || body?.raw?.TechnicalErrorDetails
            || detail;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (!data?.success) {
        throw new Error(
          data?.declineReason
          || data?.error
          || data?.raw?.Data?.Payment?.StatusDescription
          || data?.raw?.UserErrorMessage
          || data?.raw?.TechnicalErrorDetails
          || "העסקה נדחתה על ידי חברת האשראי"
        );
      }

      toast({
        title: action === "authorize" ? `מסגרת נתפסה (אישור: ${data.authNumber})` :
               action === "save_token" ? "כרטיס נשמר בהצלחה" :
               `חיוב בוצע - חשבונית ${data.documentNumber || ""}`,
      });
      // מחזירים גם את הסכום והפעולה שבוצעו בפועל, כדי שהקורא יעדכן את ההשכרה
      onSuccess?.({ ...data, amount: requiresAmount ? parseFloat(amount) : undefined, action });
      onOpenChange(false);
      // Reset
      setCardNumber(""); setCvv(""); setExpMonth(""); setExpYear("");
    } catch (err: any) {
      setDeclineError(err.message || "העסקה נדחתה");
      toast({ title: "❌ החיוב לא עבר", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-cyan-600" />
            {meta.title}
          </DialogTitle>
          {customer && <DialogDescription>{customer.name}</DialogDescription>}
        </DialogHeader>

        <Tabs value={action} onValueChange={(v) => setAction(v as PaymentAction)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="charge">חיוב</TabsTrigger>
            <TabsTrigger value="authorize">תפיסת מסגרת</TabsTrigger>
            <TabsTrigger value="save_token">שמירת כרטיס</TabsTrigger>
          </TabsList>

          <TabsContent value={action} className="space-y-4 mt-4">
            {declineError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                <p className="font-bold">❌ העסקה לא עברה — לא נגבה כסף</p>
                <p className="text-destructive/90">{declineError}</p>
                <p className="text-xs text-destructive/80">אין להמשיך בתהליך כאילו שולם. יש לנסות כרטיס אחר או אמצעי תשלום אחר.</p>
              </div>
            )}
            {requiresAmount && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>סכום (₪)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                {action === "charge" && (
                  <div>
                    <Label>מספר תשלומים</Label>
                    <Select value={payments} onValueChange={setPayments}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,8,10,12].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {customer?.payment_token && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <input type="checkbox" id="use-token" checked={useToken}
                  onChange={(e) => setUseToken(e.target.checked)} className="w-4 h-4" />
                <label htmlFor="use-token" className="text-sm cursor-pointer">
                  השתמש בכרטיס שמור (****{customer.card_last4})
                </label>
              </div>
            )}

            {!useToken && (
              <>
                <div>
                  <Label>מספר כרטיס</Label>
                  <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="1234 5678 9012 3456" maxLength={19} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>חודש</Label>
                    <Input type="number" min="1" max="12" value={expMonth}
                      onChange={(e) => setExpMonth(e.target.value)} placeholder="MM" />
                  </div>
                  <div>
                    <Label>שנה</Label>
                    <Input type="number" min="2025" max="2040" value={expYear}
                      onChange={(e) => setExpYear(e.target.value)} placeholder="YYYY" />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input value={cvv} onChange={(e) => setCvv(e.target.value)} maxLength={4} />
                  </div>
                </div>
                <div>
                  <Label>ת.ז. בעל הכרטיס</Label>
                  <Input value={citizenId} onChange={(e) => setCitizenId(e.target.value)} />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : meta.button}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>ביטול</Button>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              <Lock className="w-3 h-3 inline ml-1" />
              סליקה מאובטחת באמצעות SUMIT
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
