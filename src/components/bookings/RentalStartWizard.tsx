import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, Loader2, Trash2, Send, Copy, RefreshCw, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

interface RentalStartWizardProps {
  booking: Booking;
  customer: Customer | null;
  vehicle: Vehicle | null;
  onComplete: () => void;
  onCancel: () => void;
}

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};

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
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Document signing state
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);

  const [formData, setFormData] = useState({
    start_km: vehicle?.current_km || 0,
    start_time: format(new Date(), "HH:mm"),
    base_cost: booking.rental_cost || 0,
    paid_amount: booking.deposit_amount || 0,
    notes: "",
    contract_signed: false,
    declaration_signed: false,
    waiver_signed: false,
  });

  // Load existing documents when reaching step 2
  useEffect(() => {
    if (step === 2) {
      loadDocuments();
    }
  }, [step]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("booking_id", booking.id);
      
      if (error) throw error;
      setDocuments(data || []);

      // Sync checkbox state with signed documents
      if (data) {
        const updates: Record<string, boolean> = {};
        data.forEach((d: any) => {
          if (d.status === "signed") {
            if (d.document_type === "contract") updates.contract_signed = true;
            if (d.document_type === "waiver") updates.waiver_signed = true;
            if (d.document_type === "declaration") updates.declaration_signed = true;
          }
        });
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
        }
      }
    } catch (e) {
      console.error("Error loading documents:", e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const generateDocuments = async () => {
    setGeneratingDocs(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-document", {
        body: { action: "create", booking_id: booking.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDocuments(Array.isArray(data) ? data : []);
      toast({ title: "מסמכים נוצרו בהצלחה!" });
    } catch (e: any) {
      console.error("Error generating documents:", e);
      toast({ title: "שגיאה ביצירת מסמכים", variant: "destructive" });
    } finally {
      setGeneratingDocs(false);
    }
  };

  const getSigningUrl = (doc: any) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/sign-document?token=${doc.signing_token}`;
  };

  const copyLink = (doc: any) => {
    navigator.clipboard.writeText(getSigningUrl(doc));
    toast({ title: "הלינק הועתק!" });
  };

  const sendWhatsApp = (doc: any) => {
    if (!customer?.phone) {
      toast({ title: "אין מספר טלפון ללקוח", variant: "destructive" });
      return;
    }
    const phone = customer.phone.replace(/^0/, "972");
    const text = encodeURIComponent(
      `שלום ${customer.first_name},\nנא לחתום על ${DOC_LABELS[doc.document_type]}:\n${getSigningUrl(doc)}`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const sendAllWhatsApp = () => {
    if (!customer?.phone) {
      toast({ title: "אין מספר טלפון ללקוח", variant: "destructive" });
      return;
    }
    const phone = customer.phone.replace(/^0/, "972");
    const links = documents.map(d => `• ${DOC_LABELS[d.document_type]}: ${getSigningUrl(d)}`).join("\n");
    const text = encodeURIComponent(
      `שלום ${customer.first_name},\nנא לחתום על המסמכים הבאים:\n\n${links}`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const y = "touches" in e ? e.touches[0]?.clientY : e.clientY;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x - rect.left, y - rect.top);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const y = "touches" in e ? e.touches[0]?.clientY : e.clientY;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo(x - rect.left, y - rect.top);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
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
    setSignatureData(null);
  };

  const handleSubmit = async () => {
    if (!signatureData) {
      toast({ title: "נא לחתום על המסמך", variant: "destructive" });
      return;
    }

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

      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "פעיל",
          contract_signed: formData.contract_signed,
          declaration_signed: formData.declaration_signed,
          waiver_signed: formData.waiver_signed,
        })
        .eq("id", booking.id);

      if (bookingError) throw bookingError;

      if (vehicle) {
        const { error: vehicleError } = await supabase
          .from("vehicles")
          .update({
            status: "מושכר",
            current_km: formData.start_km,
          })
          .eq("id", vehicle.id);

        if (vehicleError) throw vehicleError;
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });

      toast({ title: "ההשכרה התחילה בהצלחה!" });
      onComplete();
    } catch (error) {
      console.error("Error starting rental:", error);
      toast({ title: "שגיאה בהתחלת ההשכרה", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if customer details are incomplete
  const missingFields: string[] = [];
  if (customer) {
    if (!customer.first_name || customer.first_name === "-") missingFields.push("שם פרטי");
    if (!customer.last_name || customer.last_name === "-") missingFields.push("שם משפחה");
    if (!customer.phone || customer.phone === "0000000000") missingFields.push("טלפון");
    if (!customer.license_front_url) missingFields.push("צילום רישיון (קדמי)");
    if (!customer.license_back_url) missingFields.push("צילום רישיון (אחורי)");
  }
  const isCustomerIncomplete = missingFields.length > 0;

  return (
    <div className="space-y-6">
      {/* Customer incomplete warning - no longer blocks */}
      {isCustomerIncomplete && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm space-y-2">
          <p className="font-bold text-yellow-700">⚠️ פרטי לקוח חסרים - מומלץ להשלים</p>
          <p className="text-yellow-600">שדות חסרים:</p>
          <ul className="list-disc list-inside text-yellow-600">
            {missingFields.map(f => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-yellow-600 text-xs">ניתן להמשיך בתהליך ולהשלים פרטים מאוחר יותר בעמוד <strong>לקוחות</strong>.</p>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              s === step
                ? "bg-cyan-600 text-white"
                : s < step
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {s < step ? <Check className="w-5 h-5" /> : s}
          </div>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">פרטי ההשכרה</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">לקוח</p>
              <p className="font-semibold">
                {customer?.first_name} {customer?.last_name}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">רכב</p>
              <p className="font-semibold">
                {vehicle?.manufacturer} {vehicle?.model}
              </p>
              <p className="text-xs text-gray-400">{vehicle?.license_plate}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">תאריכים</p>
              <p className="font-semibold text-sm">
                {booking.start_date} {booking.start_time ? `(${booking.start_time.toString().slice(0,5)})` : ""} 
                {" → "}
                {booking.end_date} {booking.end_time ? `(${booking.end_time.toString().slice(0,5)})` : ""}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">עלות</p>
              <p className="font-semibold">₪{booking.rental_cost?.toLocaleString() || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ק"מ התחלה</Label>
              <Input
                type="number"
                value={formData.start_km}
                onChange={(e) =>
                  setFormData({ ...formData, start_km: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>שעת התחלה</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>עלות בסיס</Label>
              <Input
                type="number"
                value={formData.base_cost}
                onChange={(e) =>
                  setFormData({ ...formData, base_cost: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>סכום ששולם</Label>
              <Input
                type="number"
                value={formData.paid_amount}
                onChange={(e) =>
                  setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div>
            <Label>הערות</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 2: Documents */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">מסמכים לחתימה</h3>
            {documents.length === 0 ? (
              <Button
                size="sm"
                onClick={generateDocuments}
                disabled={generatingDocs}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {generatingDocs ? (
                  <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 ml-1" />
                )}
                הפק מסמכים
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadDocuments}>
                  <RefreshCw className="w-4 h-4 ml-1" />
                  רענן
                </Button>
                <Button size="sm" variant="outline" onClick={sendAllWhatsApp}>
                  <Send className="w-4 h-4 ml-1" />
                  שלח הכל בוואטסאפ
                </Button>
              </div>
            )}
          </div>

          {loadingDocs ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-600" />
            </div>
          ) : documents.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 text-center py-4">
                לחץ על "הפק מסמכים" כדי ליצור את המסמכים עם פרטי ההזמנה
              </p>
              {/* Fallback checkboxes */}
              {["contract", "waiver", "declaration"].map((type) => {
                const fieldKey = `${type === "contract" ? "contract" : type === "waiver" ? "waiver" : "declaration"}_signed` as keyof typeof formData;
                return (
                  <div key={type} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <Checkbox
                      checked={!!formData[fieldKey]}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, [fieldKey]: !!checked })
                      }
                    />
                    <span>{DOC_LABELS[type]} נחתם</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const isSigned = doc.status === "signed";
                const fieldKey = `${doc.document_type}_signed` as keyof typeof formData;
                return (
                  <div key={doc.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isSigned || !!formData[fieldKey]}
                          disabled={isSigned}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, [fieldKey]: !!checked })
                          }
                        />
                        <span className="font-medium">{DOC_LABELS[doc.document_type]}</span>
                      </div>
                      <Badge variant={isSigned ? "success" : "warning"}>
                        {isSigned ? "נחתם ✓" : "ממתין לחתימה"}
                      </Badge>
                    </div>
                    
                    {!isSigned && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyLink(doc)}
                        >
                          <Copy className="w-3 h-3 ml-1" />
                          העתק לינק
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendWhatsApp(doc)}
                        >
                          <Send className="w-3 h-3 ml-1" />
                          וואטסאפ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(getSigningUrl(doc), "_blank")}
                        >
                          <ExternalLink className="w-3 h-3 ml-1" />
                          פתח
                        </Button>
                      </div>
                    )}
                    
                    {isSigned && doc.signed_at && (
                      <p className="text-xs text-gray-500">
                        נחתם בתאריך: {new Date(doc.signed_at).toLocaleString("he-IL")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Signature */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">חתימה דיגיטלית</h3>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>חתמו כאן:</Label>
              <Button variant="outline" size="sm" onClick={clearSignature}>
                <Trash2 className="w-4 h-4 ml-1" />
                נקה
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={500}
              height={150}
              className="w-full border-2 border-gray-300 rounded-lg bg-white touch-none cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="p-4 bg-cyan-50 rounded-lg">
            <p className="text-sm">
              <span className="font-semibold">סה"כ לתשלום:</span> ₪
              {formData.base_cost.toLocaleString()}
            </p>
            <p className="text-sm">
              <span className="font-semibold">שולם:</span> ₪
              {formData.paid_amount.toLocaleString()}
            </p>
            <p className="text-sm font-bold text-red-600">
              <span className="font-semibold">נותר:</span> ₪
              {(formData.base_cost - formData.paid_amount).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => (step > 1 ? setStep(step - 1) : onCancel())}
        >
          <ChevronRight className="w-4 h-4 ml-1" />
          {step > 1 ? "הקודם" : "ביטול"}
        </Button>

        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} className="bg-cyan-600 hover:bg-cyan-700">
            הבא
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!signatureData || isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                מעבד...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 ml-2" />
                סיום והתחלת השכרה
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
