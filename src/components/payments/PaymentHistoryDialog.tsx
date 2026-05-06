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

  const openPdf = async (docId: string) => {
    const { data } = await supabase.functions.invoke("sumit-payment", {
      body: { action: "get_pdf", documentId: docId },
    });
    const url = (data as any)?.Data?.PDFUrl || (data as any)?.Data?.URL || (data as any)?.PDFUrl;
    if (url) window.open(url, "_blank");
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
            <h4 className="font-semibold mb-2">עסקאות אשראי</h4>
            {txs.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין עסקאות</p>
            ) : (
              <div className="space-y-2">
                {txs.map(t => (
                  <div key={t.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={t.status === "success" ? "default" : "destructive"}>
                          {t.status === "success" ? "הצליח" : "נכשל"}
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
                    {(t.error_message || t.raw_response?.UserErrorMessage) && (
                      <div className="text-xs text-destructive mt-1">
                        {t.raw_response?.UserErrorMessage || t.error_message}
                      </div>
                    )}
                  </div>
                ))}
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
                  <div key={i.id} className="border rounded-lg p-3 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium">{i.document_type_name || "מסמך"} #{i.document_number || i.document_id}</span>
                      <span className="text-muted-foreground mr-3">₪{i.amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{format(new Date(i.created_at), "dd/MM/yy")}</span>
                      <Button size="sm" variant="outline" onClick={() => openPdf(i.document_id)}>
                        <FileText className="h-4 w-4" /> PDF
                      </Button>
                    </div>
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
