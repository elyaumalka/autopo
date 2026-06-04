import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, Mail, Loader2, Plus, Receipt } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"sumit_invoices">;

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailDoc, setEmailDoc] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ["sumit_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sumit_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const filtered = invoices.filter((inv) => {
    const term = search.trim();
    if (!term) return true;
    return (
      inv.customer_name?.includes(term) ||
      inv.document_number?.includes(term) ||
      inv.document_type_name?.includes(term) ||
      String(inv.amount).includes(term)
    );
  });

  const openPdf = async (inv: Invoice) => {
    if (inv.pdf_url) { window.open(inv.pdf_url, "_blank"); return; }
    setBusyId(inv.id);
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "get_pdf", documentId: inv.document_id },
      });
      if (error) throw error;
      const url = (data as any)?.pdfUrl || (data as any)?.Data?.PDFUrl || (data as any)?.Data?.URL;
      if (url) { window.open(url, "_blank"); refetch(); }
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

  const totalAmount = filtered.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="חשבוניות"
        subtitle={`${invoices.length} חשבוניות`}
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            חשבונית חדשה
          </Button>
        }
      />

      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי שם לקוח, מספר חשבונית או סכום..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center gap-2 px-4 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">סה"כ:</span>
            <span className="font-bold">₪{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{search ? "לא נמצאו חשבוניות תואמות" : "אין חשבוניות עדיין"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => (
              <Card key={inv.id} className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-100 rounded-lg">
                      <Receipt className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {inv.document_type_name || "חשבונית"} #{inv.document_number || inv.document_id}
                      </p>
                      <p className="text-sm text-muted-foreground">{inv.customer_name || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="font-bold">₪{(inv.amount || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd/MM/yy")}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openPdf(inv)} disabled={busyId === inv.id}>
                      {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEmailDoc(emailDoc === inv.document_id ? null : inv.document_id); setEmailValue(""); }}>
                      <Mail className="h-4 w-4" /> שלח
                    </Button>
                  </div>
                </div>
                {emailDoc === inv.document_id && (
                  <div className="flex items-center gap-2 mt-3">
                    <Input type="email" placeholder="email@example.com" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} />
                    <Button size="sm" onClick={() => sendEmail(inv.document_id)} disabled={busyId === inv.document_id}>
                      {busyId === inv.document_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "שלח"}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* הוספת חשבונית חדשה */}
      <InvoiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onIssued={() => refetch()}
      />
    </div>
  );
}
