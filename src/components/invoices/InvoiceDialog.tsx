import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Printer, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId?: string;
  defaultCustomerName?: string;
  defaultAmount?: number;
  defaultPaymentMethod?: string;
  defaultVehicleDetails?: string;
  defaultPeriod?: string;
  onIssued?: (invoiceNumber: string) => void;
}

const VAT_RATE = 0.18; // מע"מ בישראל

export function InvoiceDialog({
  open,
  onOpenChange,
  rentalId,
  defaultCustomerName = "",
  defaultAmount = 0,
  defaultPaymentMethod = "",
  defaultVehicleDetails = "",
  defaultPeriod = "",
  onIssued,
}: InvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState("חשבונית מס קבלה");
  const [withVat, setWithVat] = useState(true);
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [amount, setAmount] = useState<string>(String(defaultAmount || ""));
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod || "מזומן");
  const [vehicleDetails, setVehicleDetails] = useState(defaultVehicleDetails);
  const [period, setPeriod] = useState(defaultPeriod);
  const [saving, setSaving] = useState(false);

  // סנכרון ערכי ברירת מחדל בכל פתיחה
  useEffect(() => {
    if (open) {
      setCustomerName(defaultCustomerName);
      setAmount(String(defaultAmount || ""));
      setPaymentMethod(defaultPaymentMethod || "מזומן");
      setVehicleDetails(defaultVehicleDetails);
      setPeriod(defaultPeriod);
    }
  }, [open, defaultCustomerName, defaultAmount, defaultPaymentMethod, defaultVehicleDetails, defaultPeriod]);

  const total = Math.max(0, Number(amount) || 0);
  const preVat = withVat ? Math.round((total / (1 + VAT_RATE)) * 100) / 100 : total;
  const vatAmount = withVat ? Math.round((total - preVat) * 100) / 100 : 0;

  const buildInvoiceNumber = (now: Date) =>
    `${format(now, "yyyyMMdd")}-${String(Math.floor((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()))).padStart(5, "0")}`;

  const handleIssue = async () => {
    setSaving(true);
    const now = new Date();
    const invoiceNumber = buildInvoiceNumber(now);
    try {
      // רישום מספר החשבונית על ההשכרה (חיווי שהופקה חשבונית)
      if (rentalId) {
        const { error } = await supabase.from("rentals").update({ invoice_number: invoiceNumber } as any).eq("id", rentalId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["rentals"] });
        queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      }

      // הפקת מסמך להדפסה
      printInvoice(invoiceNumber, now);

      toast({ title: "החשבונית הופקה", description: `מספר: ${invoiceNumber}` });
      onIssued?.(invoiceNumber);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "שגיאה בהפקת חשבונית", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const printInvoice = (invoiceNumber: string, now: Date) => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
      toast({ title: "החלון נחסם", description: "אפשר חלונות קופצים כדי להדפיס", variant: "destructive" });
      return;
    }
    const rows = [
      `<tr><td>${vehicleDetails || "השכרת רכב"}${period ? ` (${period})` : ""}</td><td style="text-align:left">₪${preVat.toLocaleString()}</td></tr>`,
    ].join("");
    win.document.write(`
      <html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${docType} ${invoiceNumber}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#111}
        h1{font-size:22px;margin:0 0 4px}
        .muted{color:#666;font-size:13px}
        table{width:100%;border-collapse:collapse;margin-top:24px}
        th,td{border:1px solid #ddd;padding:10px;text-align:right;font-size:14px}
        th{background:#f3f4f6}
        .totals{margin-top:16px;width:280px;margin-right:auto;font-size:14px}
        .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .totals .grand{font-weight:bold;border-top:2px solid #111;margin-top:6px;padding-top:8px;font-size:16px}
      </style></head><body>
        <h1>${docType}</h1>
        <div class="muted">מספר: ${invoiceNumber} · תאריך: ${format(now, "dd/MM/yyyy")}</div>
        <div style="margin-top:18px"><strong>לכבוד:</strong> ${customerName || "-"}</div>
        <div class="muted">אופן תשלום: ${paymentMethod || "-"}</div>
        <table><thead><tr><th>פירוט</th><th style="text-align:left">סכום</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="totals">
          <div><span>סכום לפני מע"מ</span><span>₪${preVat.toLocaleString()}</span></div>
          ${withVat ? `<div><span>מע"מ (${Math.round(VAT_RATE * 100)}%)</span><span>₪${vatAmount.toLocaleString()}</span></div>` : `<div class="muted"><span>ללא מע"מ</span><span></span></div>`}
          <div class="grand"><span>סה"כ לתשלום</span><span>₪${total.toLocaleString()}</span></div>
        </div>
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-cyan-600" /> הפקת חשבונית
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>סוג מסמך</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="חשבונית">חשבונית</SelectItem>
                  <SelectItem value="חשבונית מס קבלה">חשבונית מס קבלה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={withVat} onCheckedChange={setWithVat} id="with-vat" />
              <Label htmlFor="with-vat" className="cursor-pointer">כולל מע"מ</Label>
            </div>
          </div>

          <div>
            <Label>על שם</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>סכום (₪)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>אופן תשלום</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="מזומן">מזומן</SelectItem>
                  <SelectItem value="אשראי">אשראי</SelectItem>
                  <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                  <SelectItem value="ביט">ביט</SelectItem>
                  <SelectItem value="צ׳ק">צ׳ק</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>פרטי רכב</Label>
            <Input value={vehicleDetails} onChange={(e) => setVehicleDetails(e.target.value)} placeholder="יצרן דגם - מספר רכב" />
          </div>
          <div>
            <Label>תקופת ההשכרה</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="לדוגמה: 01/06 - 05/06" />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span>לפני מע"מ:</span><span>₪{preVat.toLocaleString()}</span></div>
            {withVat && <div className="flex justify-between"><span>מע"מ ({Math.round(VAT_RATE * 100)}%):</span><span>₪{vatAmount.toLocaleString()}</span></div>}
            <div className="flex justify-between font-semibold border-t pt-1"><span>סה"כ:</span><span>₪{total.toLocaleString()}</span></div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleIssue} disabled={saving || total <= 0} className="flex-1 bg-cyan-600 hover:bg-cyan-700">
              <Printer className="h-4 w-4 ml-2" /> {saving ? "מפיק..." : "הפק והדפס"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
