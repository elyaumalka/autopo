import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Send, ExternalLink, Eye, FileText, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
  const [viewingSignature, setViewingSignature] = useState<string | null>(null);

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
                {isSigned && doc.signature_data && (
                  <Button size="sm" variant="outline" onClick={() => setViewingSignature(doc.signature_data)}>
                    <Eye className="w-3 h-3 ml-1" />
                    צפה בחתימה
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

      {/* Signature preview dialog */}
      <Dialog open={!!viewingSignature} onOpenChange={() => setViewingSignature(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>חתימה</DialogTitle>
          </DialogHeader>
          {viewingSignature && (
            <div className="border rounded-lg p-4 bg-white">
              <img src={viewingSignature} alt="חתימה" className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
