import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, Loader2, Trash2, Send, Copy, AlertTriangle, Banknote, CreditCard } from "lucide-react";
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

  // הגדרות פר-השכרה
  const requireHold = (booking as any).require_credit_hold !== false;
  const prepayMode: string = (booking as any).prepay_mode || "optional";

  // שלבי האשף (מדלגים על תפיסת מסגרת אם לא נדרשת)
  const flow: string[] = ["details", ...(requireHold ? ["hold"] : []), "payment", "sign"];
  const [stepIdx, setStepIdx] = useState(0);
  const current = flow[stepIdx];

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signingDoc, setSigningDoc] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);

  // תשלום בתחנה
  const totalCost = Number(booking.rental_cost || 0);
  const [holdCaptured, setHoldCaptured] = useState(!!(booking as any).sumit_auth_number);
  const [paidAmount, setPaidAmount] = useState(Number(booking.deposit_amount || 0));
  const sessionPaidRef = useRef(0); // כמה נגבה בתחנה (לרישום הכנסה)
  const [stationPaymentMethod, setStationPaymentMethod] = useState<string>("");
  const remaining = Math.max(0, totalCost - paidAmount);

  // חלונית מזומן (אישור הנחה בקופה)
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");

  // חלונית השלמת פרטים חסרים
  const [missingOpen, setMissingOpen] = useState(false);
  const [editPhone, setEditPhone] = useState(customer?.phone && customer.phone !== "0000000000" ? customer.phone : "");
  const [editIdNumber, setEditIdNumber] = useState(customer?.id_number && !customer.id_number.startsWith("חדש-") ? customer.id_number : "");
  const [savingDetails, setSavingDetails] = useState(false);

  const [startKm, setStartKm] = useState<number>(vehicle?.current_km || 0);
  const [startTime, setStartTime] = useState(format(new Date(), "HH:mm"));
  const [notes, setNotes] = useState("");

  // יצירת מסמכים כשמגיעים לשלב החתימה
  useEffect(() => {
    if (current === "sign") loadAndAutoGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    if (current === "sign" && !loadingDocs) initCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, currentDocIndex, loadingDocs, documents]);

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
        const firstUnsigned = sorted.findIndex((d: any) => d.status !== "signed");
        setCurrentDocIndex(firstUnsigned >= 0 ? firstUnsigned : sorted.length);
      }
    } catch (e) {
      console.error("Error loading documents:", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const sortDocs = (docs: any[]) =>
    [...docs].sort((a, b) => DOC_ORDER.indexOf(a.document_type) - DOC_ORDER.indexOf(b.document_type));

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
    if (ctx) { ctx.beginPath(); ctx.moveTo((x - rect.left) * scaleX, (y - rect.top) * scaleY); }
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
    if (ctx) { ctx.lineTo((x - rect.left) * scaleX, (y - rect.top) * scaleY); ctx.stroke(); }
  };
  const stopDrawing = () => { if (isDrawing) setHasSignature(true); setIsDrawing(false); };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round"; }
    setHasSignature(false);
  };

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
      const updated = [...documents];
      updated[currentDocIndex] = { ...currentDoc, status: "signed", signed_at: new Date().toISOString() };
      setDocuments(updated);
      const nextIndex = currentDocIndex + 1;
      if (nextIndex < documents.length) { setCurrentDocIndex(nextIndex); setHasSignature(false); }
      else toast({ title: "כל המסמכים נחתמו!" });
    } catch (e: any) {
      toast({ title: "שגיאה בחתימה", description: e.message, variant: "destructive" });
    } finally {
      setSigningDoc(false);
    }
  };

  const allDocsSigned = documents.length > 0 && documents.every((d) => d.status === "signed");

  // השלמת פרטי לקוח חסרים
  const missingFields: string[] = [];
  if (customer) {
    if (!customer.phone || customer.phone === "0000000000") missingFields.push("טלפון");
    if (!customer.id_number || customer.id_number.startsWith("חדש-")) missingFields.push("תעודת זהות");
    if (!customer.license_front_url) missingFields.push("צילום רישיון (קדמי)");
    if (!customer.license_back_url) missingFields.push("צילום רישיון (אחורי)");
    if (!(customer as any).payment_token) missingFields.push("כרטיס אשראי שמור");
  }

  const saveMissingDetails = async () => {
    if (!customer) return;
    setSavingDetails(true);
    try {
      const update: any = {};
      if (editPhone.trim()) update.phone = editPhone.trim();
      if (editIdNumber.trim()) update.id_number = editIdNumber.trim();
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from("customers").update(update).eq("id", customer.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
      toast({ title: "הפרטים עודכנו" });
      setMissingOpen(false);
    } catch (e: any) {
      toast({ title: "שגיאה בעדכון פרטים", description: e.message, variant: "destructive" });
    } finally {
      setSavingDetails(false);
    }
  };

  // אישור תשלום מזומן (הנחה בקופה)
  const confirmCash = () => {
    const amt = Number(cashAmount) || 0;
    if (amt <= 0) { toast({ title: "נא להזין סכום", variant: "destructive" }); return; }
    setPaidAmount((p) => p + amt);
    sessionPaidRef.current += amt;
    setStationPaymentMethod("מזומן");
    setCashDialogOpen(false);
    setCashAmount("");
    toast({ title: "התקבל תשלום מזומן", description: `₪${amt.toLocaleString()} — נא לוודא שהונח בקופה` });
  };

  // האם אפשר להמשיך משלב התשלום
  const canPassPayment =
    prepayMode === "mandatory" ? remaining <= 0 :
    prepayMode === "partial" ? paidAmount > 0 :
    true;

  // הפעלת ההשכרה
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const remainingPayment = Math.max(0, totalCost - paidAmount);
      const { data: rental, error: rentalError } = await supabase.from("rentals").insert({
        booking_id: booking.id,
        customer_id: booking.customer_id,
        customer_name: booking.customer_name,
        vehicle_id: booking.vehicle_id,
        vehicle_details: booking.vehicle_details,
        start_date: booking.start_date,
        start_time: startTime,
        start_km: startKm,
        planned_end_date: booking.end_date,
        planned_end_time: booking.end_time,
        base_cost: totalCost,
        total_cost: totalCost,
        paid_amount: paidAmount,
        remaining_payment: remainingPayment,
        credit_hold: booking.credit_hold,
        billing_rate_type: booking.billing_rate_type,
        billing_rate_amount: booking.billing_rate_amount,
        rental_type: booking.rental_type as any,
        notes,
        status: "פעיל",
      }).select().single();
      if (rentalError) throw rentalError;

      // רישום הכנסה על מה שנגבה בתחנה
      if (sessionPaidRef.current > 0) {
        await supabase.from("incomes").insert({
          customer_id: booking.customer_id,
          customer_name: booking.customer_name,
          rental_id: rental?.id || null,
          vehicle_id: booking.vehicle_id,
          amount: sessionPaidRef.current,
          date: booking.start_date,
          type: "השכרה",
          payment_method: stationPaymentMethod || null,
          notes: "תשלום בתחנה - תחילת השכרה",
        } as any);
      }

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
        await supabase.from("vehicles").update({ status: "מושכר", current_km: startKm }).eq("id", vehicle.id);
      }

      ["bookings", "bookings-week", "rentals", "rentals-active", "vehicles", "vehicles-all", "incomes"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );

      toast({ title: "ההשכרה הופעלה בהצלחה!" });
      onComplete();
    } catch (error: any) {
      console.error("Error starting rental:", error);
      toast({ title: "שגיאה בהפעלת ההשכרה", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remote signing
  const getSigningUrl = (doc: any) => `${window.location.origin}/sign-document?token=${doc.signing_token}`;
  const copyLink = (doc: any) => { navigator.clipboard.writeText(getSigningUrl(doc)); toast({ title: "הלינק הועתק!" }); };
  const sendWhatsApp = (doc: any) => {
    if (!customer?.phone) return;
    const phone = customer.phone.replace(/^0/, "972");
    const text = encodeURIComponent(`שלום ${customer.first_name},\nנא לחתום על ${DOC_LABELS[doc.document_type]}:\n${getSigningUrl(doc)}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const customerForPay = customer ? {
    id: customer.id,
    name: `${customer.first_name} ${customer.last_name}`,
    phone: customer.phone,
    email: customer.email || undefined,
    address: customer.address || undefined,
    city: customer.city || undefined,
    citizenId: customer.id_number,
    payment_token: (customer as any).payment_token,
    card_last4: (customer as any).card_last4,
    card_expiry: (customer as any).card_expiry,
  } : { name: booking.customer_name || "" };

  const currentDoc = documents[currentDocIndex];
  const details = currentDoc?.rental_details || {};

  const goNext = () => {
    if (current === "details" && missingFields.length > 0) {
      setMissingOpen(true);
      return;
    }
    setStepIdx((i) => Math.min(i + 1, flow.length - 1));
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {flow.map((s, i) => (
          <div key={s} className={`px-3 py-1 rounded-full text-xs font-medium ${i === stepIdx ? "bg-cyan-600 text-white" : i < stepIdx ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
            {s === "details" ? "פרטים" : s === "hold" ? "מסגרת" : s === "payment" ? "תשלום" : "חתימה"}
          </div>
        ))}
      </div>

      {/* ===== DETAILS ===== */}
      {current === "details" && (
        <div className="space-y-4">
          {missingFields.length > 0 && (
            <button
              onClick={() => setMissingOpen(true)}
              className="w-full flex items-center gap-2 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-yellow-800 hover:bg-yellow-100"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">חסרים פרטי לקוח — לחץ להשלמה ({missingFields.join(", ")})</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">לקוח</p>
              <p className="font-semibold">{customer ? `${customer.first_name} ${customer.last_name}` : booking.customer_name}</p>
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
              <p className="font-semibold">₪{totalCost.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ק"מ התחלה</Label>
              <Input type="number" value={startKm} onChange={(e) => setStartKm(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>שעת יציאה</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRemoteDialogOpen(true)}>
              <Send className="w-4 h-4 ml-1" /> החתמה מרחוק
            </Button>
          </div>
        </div>
      )}

      {/* ===== HOLD ===== */}
      {current === "hold" && (
        <div className="space-y-4 text-center">
          <h3 className="text-lg font-semibold">תפיסת מסגרת אשראי</h3>
          {holdCaptured ? (
            <div className="p-6 bg-green-50 rounded-lg">
              <Check className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800">המסגרת נתפסה בהצלחה</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">יש לתפוס מסגרת אשראי בסך ₪{Number(booking.credit_hold || totalCost).toLocaleString()} לפני המשך התהליך.</p>
              <PaymentButton
                defaultAction="authorize"
                label="תפיסת מסגרת אשראי"
                amount={Number(booking.credit_hold || totalCost)}
                description="תפיסת מסגרת אשראי"
                variant="default"
                bookingId={booking.id}
                customer={customerForPay}
                onSuccess={(r: any) => { if (r?.action === "authorize" && r?.success) setHoldCaptured(true); }}
              />
            </div>
          )}
        </div>
      )}

      {/* ===== PAYMENT ===== */}
      {current === "payment" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">תשלום</h3>
          <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span>סה"כ:</span><span className="font-semibold">₪{totalCost.toLocaleString()}</span></div>
            <div className="flex justify-between text-green-700"><span>שולם:</span><span>₪{paidAmount.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold text-red-600"><span>נותר:</span><span>₪{remaining.toLocaleString()}</span></div>
          </div>

          <p className="text-sm text-center text-muted-foreground">
            {prepayMode === "mandatory" ? "תשלום מלא מראש חובה" : prepayMode === "partial" ? "נדרש תשלום חלקי מראש" : "תשלום מראש אופציונלי"}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-1" onClick={() => { setCashAmount(String(remaining)); setCashDialogOpen(true); }}>
              <Banknote className="w-6 h-6 text-green-600" />
              תשלום במזומן
            </Button>
            <div className="flex">
              <PaymentButton
                defaultAction="charge"
                label="תשלום באשראי"
                amount={remaining}
                description="תשלום השכרה"
                variant="outline"
                className="w-full h-auto py-4"
                bookingId={booking.id}
                customer={customerForPay}
                onSuccess={(r: any) => {
                  if (r?.action === "charge" && r?.success) {
                    const charged = Number(r?.amount || 0);
                    if (charged > 0) { setPaidAmount((p) => p + charged); sessionPaidRef.current += charged; setStationPaymentMethod("אשראי"); }
                  }
                }}
              />
            </div>
          </div>
          {prepayMode === "optional" && (
            <p className="text-xs text-center text-muted-foreground">ניתן לדלג ולהמשיך ללא תשלום מראש.</p>
          )}
        </div>
      )}

      {/* ===== SIGN ===== */}
      {current === "sign" && (
        <div className="space-y-4">
          {loadingDocs || generatingDocs ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-600" />
              <p className="text-sm text-muted-foreground mt-2">מכין מסמכים...</p>
            </div>
          ) : allDocsSigned ? (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">כל המסמכים נחתמו!</h3>
              </div>
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-sm">{DOC_LABELS[doc.document_type]}</span>
                  <Badge variant="success">נחתם ✓</Badge>
                </div>
              ))}
            </div>
          ) : currentDoc ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{DOC_LABELS[currentDoc.document_type]} ({currentDocIndex + 1}/{documents.length})</h3>
                <Badge variant="warning">ממתין לחתימה</Badge>
              </div>
              <div className="border rounded-lg p-4 bg-white max-h-[300px] overflow-y-auto">
                <DocumentContent documentType={currentDoc.document_type} details={details} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="font-semibold">חתימה:</Label>
                  <Button variant="outline" size="sm" onClick={clearSignature}><Trash2 className="w-4 h-4 ml-1" />נקה</Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full border-2 border-foreground/20 rounded-lg bg-white touch-none cursor-crosshair"
                  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                />
                <Button className="w-full bg-green-600 hover:bg-green-700" disabled={!hasSignature || signingDoc} onClick={handleSignCurrentDoc}>
                  {signingDoc ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />שומר חתימה...</> : <><Check className="w-4 h-4 ml-2" />חתום ועבור הלאה</>}
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
        <Button variant="outline" onClick={() => (stepIdx > 0 ? setStepIdx((i) => i - 1) : onCancel())}>
          <ChevronRight className="w-4 h-4 ml-1" />
          {stepIdx > 0 ? "הקודם" : "ביטול"}
        </Button>

        {current === "details" && (
          <Button onClick={goNext} className="bg-cyan-600 hover:bg-cyan-700">המשך<ChevronLeft className="w-4 h-4 mr-1" /></Button>
        )}
        {current === "hold" && (
          <Button onClick={() => setStepIdx((i) => i + 1)} disabled={!holdCaptured} className="bg-cyan-600 hover:bg-cyan-700">
            המשך<ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        )}
        {current === "payment" && (
          <Button onClick={() => setStepIdx((i) => i + 1)} disabled={!canPassPayment} className="bg-cyan-600 hover:bg-cyan-700">
            {prepayMode === "optional" && remaining > 0 ? "דלג והמשך" : "המשך"}<ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        )}
        {current === "sign" && (
          allDocsSigned ? (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מפעיל...</> : <><Check className="w-4 h-4 ml-2" />הפעל השכרה</>}
            </Button>
          ) : (
            <Button disabled variant="outline" className="opacity-50">יש לחתום על כל המסמכים</Button>
          )
        )}
      </div>

      {/* חלונית השלמת פרטים חסרים */}
      <Dialog open={missingOpen} onOpenChange={setMissingOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>השלמת פרטי לקוח</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">חסרים פרטים ללקוח. נא להשלים:</p>
            <div>
              <Label>טלפון</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="050-0000000" />
            </div>
            <div>
              <Label>תעודת זהות</Label>
              <Input value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} placeholder="ת.ז" />
            </div>
            {(missingFields.includes("צילום רישיון (קדמי)") || missingFields.includes("צילום רישיון (אחורי)") || missingFields.includes("כרטיס אשראי שמור")) && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                שים לב: חסרים גם {[missingFields.includes("צילום רישיון (קדמי)") || missingFields.includes("צילום רישיון (אחורי)") ? "צילום רישיון" : null, missingFields.includes("כרטיס אשראי שמור") ? "כרטיס אשראי" : null].filter(Boolean).join(" ו")} — ניתן להשלים בכרטיס הלקוח / בשלב תפיסת המסגרת.
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={saveMissingDetails} disabled={savingDetails} className="flex-1">
                {savingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור והמשך"}
              </Button>
              <Button variant="outline" onClick={() => { setMissingOpen(false); setStepIdx((i) => Math.min(i + 1, flow.length - 1)); }}>המשך בלי</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* חלונית תשלום מזומן */}
      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>תשלום במזומן</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              יש להניח את הכסף בקופה המיועדת ולאשר את הסכום שהונח.
            </div>
            <div>
              <Label>סכום שהונח בקופה (₪)</Label>
              <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmCash} className="flex-1 bg-green-600 hover:bg-green-700"><Check className="w-4 h-4 ml-1" />אישור — הונח בקופה</Button>
              <Button variant="outline" onClick={() => setCashDialogOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote signing */}
      <Dialog open={remoteDialogOpen} onOpenChange={setRemoteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>החתמה מרחוק</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">שלח ללקוח קישורים לחתימה דיגיטלית מרחוק.</p>
            <Button variant="outline" className="w-full" onClick={async () => { if (documents.length === 0) await generateDocuments(); }}>
              צור מסמכים לחתימה
            </Button>
            {documents.map((doc) => (
              <div key={doc.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{DOC_LABELS[doc.document_type]}</span>
                  <Badge variant={doc.status === "signed" ? "success" : "warning"}>{doc.status === "signed" ? "נחתם ✓" : "ממתין"}</Badge>
                </div>
                {doc.status !== "signed" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(doc)}><Copy className="w-3 h-3 ml-1" />העתק</Button>
                    <Button size="sm" variant="outline" onClick={() => sendWhatsApp(doc)}><Send className="w-3 h-3 ml-1" />וואטסאפ</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
