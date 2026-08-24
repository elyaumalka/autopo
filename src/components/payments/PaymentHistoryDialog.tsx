import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, FileText, RefreshCw, Mail, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId?: string;
  bookingId?: string;
  rentalId?: string;
  customerEmail?: string;
  title?: string;
}

interface Tx {
  id: string;
  created_at: string;
  transaction_type: string;
  status: string;
  amount: number | null;
  auth_number: string | null;
  card_last4: string | null;
  customer_name: string | null;
  error_message: string | null;
  raw_response: any;
}

interface Inv {
  id: string;
  document_number: string | null;
  document_type_name: string | null;
  amount: number;
  created_at: string;
  pdf_url: string | null;
  document_id: string;
}

const typeLabel: Record<string, string> = {
  authorize: "תפיסת מסגרת (J5)",
  charge: "חיוב",
  charge_token: "חיוב בכרטיס שמור",
  save_token: "שמירת כרטיס",
};

export function PaymentHistoryDialog({ open, onOpenChange, customerId, bookingId, rentalId, customerEmail, title }: Props) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let txQ = supabase.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(50);
    let invQ = supabase.from("sumit_invoices").select("*").order("created_at", { ascending: false }).limit(50);
    if (customerId) { txQ = txQ.eq("customer_id", customerId); invQ = invQ.eq("customer_id", customerId); }
    if (bookingId) { txQ = txQ.eq("booking_id", bookingId); invQ = invQ.eq("booking_id", bookingId); }
    if (rentalId) { txQ = txQ.eq("rental_id", rentalId); invQ = invQ.eq("rental_id", rentalId); }
    const [{ data: t }, { data: i }] = await Promise.all([txQ, invQ]);
    setTxs((t || []) as any);
    setInvs((i || []) as any);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, customerId, bookingId, rentalId]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailDoc, setEmailDoc] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState(customerEmail || "");
  const [onlyFailed, setOnlyFailed] = useState(false);

  const failedCount = txs.filter(t => t.status !== "success").length;
  const visibleTxs = onlyFailed ? txs.filter(t => t.status !== "success") : txs;

  // סיבת הסירוב האמיתית מחברת האשראי
  const declineReason = (t: Tx): string | null => {
    let parsed: any = null;
    try { parsed = t.error_message ? JSON.parse(t.error_message) : null; } catch { /* ignore */ }
    return parsed?.reason
      || t.raw_response?.Data?.Payment?.StatusDescription
      || t.raw_response?.UserErrorMessage
      || t.raw_response?.TechnicalErrorDetails
      || t.error_message
      || null;
  };

  const openPdf = async (inv: Inv) => {
    if (inv.pdf_url) { window.open(inv.pdf_url, "_blank"); return; }
    setBusyId(inv.id);
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "get_pdf", documentId: inv.document_id },
      });
      if (error) throw error;
      const url = (data as any)?.pdfUrl || (data as any)?.Data?.PDFUrl || (data as any)?.Data?.URL || (data as any)?.PDFUrl;
      if (url) { window.open(url, "_blank"); load(); }
      else throw new Error("לא נמצא קישור PDF");
    } catch (e: any) {
      toast({ title: "שגיאה בהורדת PDF", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const sendEmail = async (docId: string) => {
    if (!emailValue) { toast({ title: "נא להזין אימייל", variant: "destructive" }); return; }
    setBusyId(docId);
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "send_invoice", documentId: docId, email: emailValue },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.raw?.UserErrorMessage || "שליחה נכשלה");
      toast({ title: "החשבונית נשלחה" });
      setEmailDoc(null);
    } catch (e: any) {
      toast({ title: "שגיאה בשליחה", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> היסטוריית תשלומים{title ? ` - ${title}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> רענן
          </Button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">
                עסקאות אשראי
                {failedCount > 0 && (
                  <span className="text-destructive text-xs font-normal mr-2">
                    ({failedCount} נכשלו)
                  </span>
                )}
              </h4>
              <Button size="sm" variant={onlyFailed ? "destructive" : "outline"} onClick={() => setOnlyFailed(v => !v)}>
                {onlyFailed ? "הצג הכל" : "הצג רק שנכשלו"}
              </Button>
            </div>
            {visibleTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין עסקאות</p>
            ) : (
              <div className="space-y-2">
                {visibleTxs.map(t => {
                  const failed = t.status !== "success";
                  return (
                  <div key={t.id} className={`border rounded-lg p-3 text-sm ${failed ? "border-destructive/50 bg-destructive/5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={failed ? "destructive" : "default"}>
                          {failed ? "נכשל — לא נגבה" : "אושר"}
                        </Badge>
                        <span className="font-medium">{typeLabel[t.transaction_type] || t.transaction_type}</span>
                        {t.amount != null && <span className="text-muted-foreground">₪{t.amount}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yy HH:mm")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      {t.card_last4 && <span>כרטיס: ****{t.card_last4}</span>}
                      {t.auth_number && <span>אישור: {t.auth_number}</span>}
                      {t.customer_name && <span>{t.customer_name}</span>}
                    </div>
                    {failed && declineReason(t) && (
                      <div className="text-xs text-destructive mt-1 font-medium">
                        סיבת הסירוב: {declineReason(t)}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-2">חשבוניות</h4>
            {invs.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין חשבוניות</p>
            ) : (
              <div className="space-y-2">
                {invs.map(i => (
                  <div key={i.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{i.document_type_name || "חשבונית"} #{i.document_number || i.document_id}</span>
                        <span className="text-muted-foreground mr-3">₪{i.amount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{format(new Date(i.created_at), "dd/MM/yy")}</span>
                        <Button size="sm" variant="outline" onClick={() => openPdf(i)} disabled={busyId === i.id}>
                          {busyId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEmailDoc(emailDoc === i.document_id ? null : i.document_id); setEmailValue(customerEmail || emailValue); }}>
                          <Mail className="h-4 w-4" /> שלח
                        </Button>
                      </div>
                    </div>
                    {emailDoc === i.document_id && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input type="email" placeholder="email@example.com" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
                        <Button size="sm" onClick={() => sendEmail(i.document_id)} disabled={busyId === i.document_id}>
                          {busyId === i.document_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "שלח"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
