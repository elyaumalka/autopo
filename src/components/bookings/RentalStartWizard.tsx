import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, Loader2, Trash2, Send, Copy, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import DocumentContent from "@/components/signing/DocumentContent";
import { PaymentButton } from "@/components/payments/PaymentButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};

const DOC_ORDER = ["contract", "waiver", "declaration"];

interface RentalStartWizardProps {
  booking: Booking;
  customer: Customer | null;
  vehicle: Vehicle | null;
  onComplete: () => void;
  onCancel: () => void;
}

export default function RentalStartWizard({
  booking,
  customer,
  vehicle,
  onComplete,
  onCancel,
}: RentalStartWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);

  // Sequential signing: which doc index we're on
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signingDoc, setSigningDoc] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Remote signing dialog
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    start_km: vehicle?.current_km || 0,
    start_time: format(new Date(), "HH:mm"),
    base_cost: booking.rental_cost || 0,
    paid_amount: booking.deposit_amount || 0,
    notes: "",
  });

  // When entering step 2, generate docs and start sequential signing
  useEffect(() => {
    if (step === 2) {
      loadAndAutoGenerate();
    }
  }, [step]);

  // Init canvas when doc changes
  useEffect(() => {
    if (step === 2 && !loadingDocs) {
      initCanvas();
    }
  }, [step, currentDocIndex, loadingDocs, documents]);

  const initCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
      setHasSignature(false);
    }, 100);
  };

  const loadAndAutoGenerate = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("booking_id", booking.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        await generateDocuments();
      } else {
        const sorted = sortDocs(data);
        setDocuments(sorted);
        // Skip to first unsigned doc
        const firstUnsigned = sorted.findIndex((d: any) => d.status !== "signed");
        setCurrentDocIndex(firstUnsigned >= 0 ? firstUnsigned : sorted.length);
      }
    } catch (e) {
      console.error("Error loading documents:", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const sortDocs = (docs: any[]) => {
    return [...docs].sort(
      (a, b) => DOC_ORDER.indexOf(a.document_type) - DOC_ORDER.indexOf(b.document_type)
    );
  };

  const generateDocuments = async () => {
    setGeneratingDocs(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: { action: "create", booking_id: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const sorted = sortDocs(Array.isArray(data) ? data : []);
      setDocuments(sorted);
      setCurrentDocIndex(0);
    } catch (e: any) {
      console.error("Error generating documents:", e);
      toast({ title: "שגיאה ביצירת מסמכים", variant: "destructive" });
    } finally {
      setGeneratingDocs(false);
    }
  };

  // Canvas drawing
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const y = "touches" in e ? e.touches[0]?.clientY : e.clientY;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo((x - rect.left) * scaleX, (y - rect.top) * scaleY);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const y = "touches" in e ? e.touches[0]?.clientY : e.clientY;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo((x - rect.left) * scaleX, (y - rect.top) * scaleY);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) setHasSignature(true);
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
    setHasSignature(false);
  };

  // Sign current document and move to next
  const handleSignCurrentDoc = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const currentDoc = documents[currentDocIndex];
    if (!currentDoc) return;

    setSigningDoc(true);
    try {
      const signatureData = canvas.toDataURL("image/png");
      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: { action: "sign", token: currentDoc.signing_token, signature_data: signatureData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state
      const updated = [...documents];
      updated[currentDocIndex] = { ...currentDoc, status: "signed", signed_at: new Date().toISOString() };
      setDocuments(updated);

      // Move to next unsigned or finish
      const nextIndex = currentDocIndex + 1;
      if (nextIndex < documents.length) {
        setCurrentDocIndex(nextIndex);
        setHasSignature(false);
      } else {
        // All done - auto submit
        toast({ title: "כל המסמכים נחתמו!" });
      }
    } catch (e: any) {
      toast({ title: "שגיאה בחתימה", description: e.message, variant: "destructive" });
    } finally {
      setSigningDoc(false);
    }
  };

  const allDocsSigned = documents.length > 0 && documents.every((d) => d.status === "signed");

  // Submit rental
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const totalCost = formData.base_cost;
      const remainingPayment = totalCost - formData.paid_amount;

      const { error: rentalError } = await supabase.from("rentals").insert({
        booking_id: booking.id,
        customer_id: booking.customer_id,
        customer_name: booking.customer_name,
        vehicle_id: booking.vehicle_id,
        vehicle_details: booking.vehicle_details,
        start_date: booking.start_date,
        start_time: formData.start_time,
        start_km: formData.start_km,
        planned_end_date: booking.end_date,
        planned_end_time: booking.end_time,
        base_cost: formData.base_cost,
        total_cost: totalCost,
        paid_amount: formData.paid_amount,
        remaining_payment: remainingPayment,
        credit_hold: booking.credit_hold,
        notes: formData.notes,
        status: "פעיל",
      });
      if (rentalError) throw rentalError;

      const signedTypes = documents.filter((d) => d.status === "signed").map((d) => d.document_type);
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "פעיל",
          contract_signed: signedTypes.includes("contract"),
          declaration_signed: signedTypes.includes("declaration"),
          waiver_signed: signedTypes.includes("waiver"),
        })
        .eq("id", booking.id);
      if (bookingError) throw bookingError;

      if (vehicle) {
        await supabase
          .from("vehicles")
          .update({ status: "מושכר", current_km: formData.start_km })
          .eq("id", vehicle.id);
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-all"] });

      toast({ title: "ההשכרה התחילה בהצלחה!" });
      onComplete();
    } catch (error) {
      console.error("Error starting rental:", error);
      toast({ title: "שגיאה בהתחלת ההשכרה", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remote signing helpers
  const getSigningUrl = (doc: any) => `${window.location.origin}/sign-document?token=${doc.signing_token}`;

  const copyLink = (doc: any) => {
    navigator.clipboard.writeText(getSigningUrl(doc));
    toast({ title: "הלינק הועתק!" });
  };

  const sendWhatsApp = (doc: any) => {
    if (!customer?.phone) return;
    const phone = customer.phone.replace(/^0/, "972");
    const text = encodeURIComponent(`שלום ${customer.first_name},\nנא לחתום על ${DOC_LABELS[doc.document_type]}:\n${getSigningUrl(doc)}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const sendAllWhatsApp = () => {
    if (!customer?.phone) return;
    const phone = customer.phone.replace(/^0/, "972");
    const links = documents.map((d) => `• ${DOC_LABELS[d.document_type]}: ${getSigningUrl(d)}`).join("\n");
    const text = encodeURIComponent(`שלום ${customer.first_name},\nנא לחתום על המסמכים הבאים:\n\n${links}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  // Open remote signing: first generate docs if needed
  const handleRemoteSigning = async () => {
    if (documents.length === 0) {
      setGeneratingDocs(true);
      try {
        const { data, error } = await supabase.functions.invoke("sign-document", {
          body: { action: "create", booking_id: booking.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setDocuments(sortDocs(Array.isArray(data) ? data : []));
      } catch (e: any) {
        toast({ title: "שגיאה ביצירת מסמכים", variant: "destructive" });
        return;
      } finally {
        setGeneratingDocs(false);
      }
    }
    setRemoteDialogOpen(true);
  };

  // Missing customer fields
  const missingFields: string[] = [];
  if (customer) {
    if (!customer.first_name || customer.first_name === "-") missingFields.push("שם פרטי");
    if (!customer.last_name || customer.last_name === "-") missingFields.push("שם משפחה");
    if (!customer.phone || customer.phone === "0000000000") missingFields.push("טלפון");
    if (!customer.license_front_url) missingFields.push("צילום רישיון (קדמי)");
    if (!customer.license_back_url) missingFields.push("צילום רישיון (אחורי)");
  }

  const currentDoc = documents[currentDocIndex];
  const details = currentDoc?.rental_details || {};

  return (
    <div className="space-y-6">
      {/* Customer incomplete warning */}
      {missingFields.length > 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm space-y-2">
          <p className="font-bold text-yellow-700">⚠️ פרטי לקוח חסרים - מומלץ להשלים</p>
          <ul className="list-disc list-inside text-yellow-600">
            {missingFields.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              s === step
                ? "bg-cyan-600 text-white"
                : s < step
                ? "bg-green-500 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <Check className="w-5 h-5" /> : s}
          </div>
        ))}
      </div>

      {/* ===== STEP 1: Rental Details ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">פרטי ההשכרה</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoteSigning}
              disabled={generatingDocs}
            >
              {generatingDocs ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Send className="w-4 h-4 ml-1" />}
              החתמה מרחוק
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">לקוח</p>
              <p className="font-semibold">{customer?.first_name} {customer?.last_name}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">רכב</p>
              <p className="font-semibold">{vehicle?.manufacturer} {vehicle?.model}</p>
              <p className="text-xs text-muted-foreground">{vehicle?.license_plate}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">תאריכים</p>
              <p className="font-semibold text-sm">
                {booking.start_date} {booking.start_time ? `(${booking.start_time.toString().slice(0, 5)})` : ""}{" → "}
                {booking.end_date} {booking.end_time ? `(${booking.end_time.toString().slice(0, 5)})` : ""}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">עלות</p>
              <p className="font-semibold">₪{booking.rental_cost?.toLocaleString() || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ק"מ התחלה</Label>
              <Input
                type="number"
                value={formData.start_km}
                onChange={(e) => setFormData({ ...formData, start_km: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>שעת התחלה</Label>
              <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>עלות בסיס</Label>
              <Input
                type="number"
                value={formData.base_cost}
                onChange={(e) => setFormData({ ...formData, base_cost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>סכום ששולם</Label>
              <Input
                type="number"
                value={formData.paid_amount}
                onChange={(e) => setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
        </div>
      )}

      {/* ===== STEP 2: Sequential Document Signing ===== */}
      {step === 2 && (
        <div className="space-y-4">
          {loadingDocs || generatingDocs ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-600" />
              <p className="text-sm text-muted-foreground mt-2">מכין מסמכים...</p>
            </div>
          ) : allDocsSigned ? (
            // All signed - show summary and submit
            <div className="space-y-4">
              <div className="text-center space-y-2 py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">כל המסמכים נחתמו!</h3>
              </div>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium text-sm">{DOC_LABELS[doc.document_type]}</span>
                    <Badge variant="success">נחתם ✓</Badge>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-cyan-50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>סה"כ לתשלום:</span>
                  <span className="font-semibold">₪{formData.base_cost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>שולם:</span>
                  <span>₪{formData.paid_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600">
                  <span>נותר:</span>
                  <span>₪{(formData.base_cost - formData.paid_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : currentDoc ? (
            // Show current document for signing
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {DOC_LABELS[currentDoc.document_type]} ({currentDocIndex + 1}/{documents.length})
                </h3>
                <Badge variant="warning">ממתין לחתימה</Badge>
              </div>

              {/* Document content - scrollable */}
              <div className="border rounded-lg p-4 bg-white max-h-[300px] overflow-y-auto">
                <DocumentContent documentType={currentDoc.document_type} details={details} />
              </div>

              {/* Signature pad */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold">חתימה:</Label>
                  <Button variant="outline" size="sm" onClick={clearSignature}>
                    <Trash2 className="w-4 h-4 ml-1" />
                    נקה
                  </Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full border-2 border-foreground/20 rounded-lg bg-white touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!hasSignature || signingDoc}
                  onClick={handleSignCurrentDoc}
                >
                  {signingDoc ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" />שומר חתימה...</>
                  ) : (
                    <><Check className="w-4 h-4 ml-2" />חתום ועבור הלאה</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">אין מסמכים להצגה</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => (step > 1 ? setStep(step - 1) : onCancel())}>
          <ChevronRight className="w-4 h-4 ml-1" />
          {step > 1 ? "הקודם" : "ביטול"}
        </Button>

        {step === 1 ? (
          <Button onClick={() => setStep(2)} className="bg-cyan-600 hover:bg-cyan-700">
            המשך לחתימה
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        ) : allDocsSigned ? (
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</>
            ) : (
              <><Check className="w-4 h-4 ml-2" />סיום והתחלת השכרה</>
            )}
          </Button>
        ) : (
          <Button disabled variant="outline" className="opacity-50">
            יש לחתום על כל המסמכים
          </Button>
        )}
      </div>

      {/* Remote Signing Dialog */}
      <Dialog open={remoteDialogOpen} onOpenChange={setRemoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>החתמה מרחוק</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              שלח ללקוח קישורים לחתימה דיגיטלית מרחוק. הלקוח יוכל לפתוח את הקישור ולחתום מהטלפון.
            </p>

            {documents.length > 0 && (
              <>
                <Button variant="outline" className="w-full" onClick={sendAllWhatsApp}>
                  <Send className="w-4 h-4 ml-2" />
                  שלח הכל בוואטסאפ
                </Button>

                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{DOC_LABELS[doc.document_type]}</span>
                        <Badge variant={doc.status === "signed" ? "success" : "warning"}>
                          {doc.status === "signed" ? "נחתם ✓" : "ממתין"}
                        </Badge>
                      </div>
                      {doc.status !== "signed" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyLink(doc)}>
                            <Copy className="w-3 h-3 ml-1" />
                            העתק
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendWhatsApp(doc)}>
                            <Send className="w-3 h-3 ml-1" />
                            וואטסאפ
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
