import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText, Eye, CheckCircle, Clock, Download } from "lucide-react";
import { motion } from "framer-motion";
import { downloadSignedDocument } from "@/lib/downloadSignedDocument";
import { toast } from "@/hooks/use-toast";

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewingSignature, setViewingSignature] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["document_signatures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_signatures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = documents.filter((doc) => {
    const matchesSearch =
      !searchTerm ||
      doc.customer_name?.includes(searchTerm) ||
      doc.vehicle_details?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesType = typeFilter === "all" || doc.document_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const signedCount = documents.filter((d) => d.status === "signed").length;
  const pendingCount = documents.filter((d) => d.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader title="מסמכים חתומים" subtitle={`${signedCount} חתומים | ${pendingCount} ממתינים`} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי לקוח או רכב..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="signed">נחתם</SelectItem>
            <SelectItem value="pending">ממתין</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="סוג מסמך" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="contract">חוזה השכרה</SelectItem>
            <SelectItem value="waiver">כתב ויתור</SelectItem>
            <SelectItem value="declaration">תצהיר נהג</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">טוען מסמכים...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">לא נמצאו מסמכים</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((doc, i) => {
            const isSigned = doc.status === "signed";
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-4 bg-card rounded-xl border"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isSigned ? "bg-green-100" : "bg-amber-100"}`}>
                    {isSigned ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{DOC_LABELS[doc.document_type]}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.customer_name || "—"} • {doc.vehicle_details || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("he-IL")}
                      {isSigned && doc.signed_at && ` • נחתם: ${new Date(doc.signed_at).toLocaleString("he-IL")}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={isSigned ? "success" : "warning"}>
                    {isSigned ? "נחתם" : "ממתין"}
                  </Badge>
                  {isSigned && doc.signature_data && (
                    <Button size="sm" variant="outline" onClick={() => setViewingSignature(doc.signature_data)}>
                      <Eye className="w-4 h-4 ml-1" />
                      חתימה
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Signature preview */}
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
    </div>
  );
}
