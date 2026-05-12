import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Send, ExternalLink, Eye, FileText, CheckCircle, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { downloadSignedDocument } from "@/lib/downloadSignedDocument";
import DocumentContent from "@/components/signing/DocumentContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};

interface DocumentsListProps {
  bookingId: string;
  customerPhone?: string | null;
  customerName?: string | null;
  showActions?: boolean;
}

export default function DocumentsList({ bookingId, customerPhone, customerName, showActions = true }: DocumentsListProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [bookingId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("booking_id", bookingId);
      if (error) throw error;
      setDocuments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSigningUrl = (doc: any) => `${window.location.origin}/sign-document?token=${doc.signing_token}`;

  const copyLink = (doc: any) => {
    navigator.clipboard.writeText(getSigningUrl(doc));
    toast({ title: "הלינק הועתק!" });
  };

  const sendWhatsApp = (doc: any) => {
    if (!customerPhone) return;
    const phone = customerPhone.replace(/^0/, "972");
    const text = encodeURIComponent(`שלום ${customerName || ""},\nנא לחתום על ${DOC_LABELS[doc.document_type]}:\n${getSigningUrl(doc)}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        לא הופקו מסמכים עדיין
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => {
          const isSigned = doc.status === "signed";
          return (
            <div key={doc.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{DOC_LABELS[doc.document_type]}</span>
                </div>
                <Badge variant={isSigned ? "success" : "warning"}>
                  {isSigned ? "נחתם ✓" : "ממתין"}
                </Badge>
              </div>

              {isSigned && doc.signed_at && (
                <p className="text-xs text-muted-foreground">
                  נחתם: {new Date(doc.signed_at).toLocaleString("he-IL")}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                {isSigned && (
                  <Button size="sm" variant="outline" onClick={() => setViewingDoc(doc)}>
                    <Eye className="w-3 h-3 ml-1" />
                    צפה במסמך
                  </Button>
                )}
                {showActions && !isSigned && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => copyLink(doc)}>
                      <Copy className="w-3 h-3 ml-1" />
                      העתק לינק
                    </Button>
                    {customerPhone && (
                      <Button size="sm" variant="outline" onClick={() => sendWhatsApp(doc)}>
                        <Send className="w-3 h-3 ml-1" />
                        וואטסאפ
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => window.open(getSigningUrl(doc), "_blank")}>
                      <ExternalLink className="w-3 h-3 ml-1" />
                      פתח
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Document preview dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{viewingDoc ? DOC_LABELS[viewingDoc.document_type] : "מסמך"}</DialogTitle>
          </DialogHeader>
          {viewingDoc && (
            <div className="space-y-4">
              {/* Document content with filled details */}
              <div className="border rounded-lg p-4 bg-white">
                <DocumentContent
                  documentType={viewingDoc.document_type}
                  details={viewingDoc.rental_details || {}}
                />
              </div>

              {/* Signature */}
              {viewingDoc.signature_data && (
                <div className="border rounded-lg p-4 bg-white space-y-2">
                  <h3 className="font-semibold text-sm">חתימת הלקוח:</h3>
                  <img src={viewingDoc.signature_data} alt="חתימה" className="w-full max-w-[300px] mx-auto" />
                  {viewingDoc.signed_at && (
                    <p className="text-xs text-muted-foreground text-center">
                      נחתם בתאריך: {new Date(viewingDoc.signed_at).toLocaleString("he-IL")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
