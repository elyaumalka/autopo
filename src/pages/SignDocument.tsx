import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.jpg";
import DocumentContent from "@/components/signing/DocumentContent";

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};


export default function SignDocument() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) {
      setError("לינק לא תקין");
      setLoading(false);
      return;
    }
    fetchDocument();
  }, [token]);

  const fetchDocument = async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sign-document", {
        body: { action: "get", token },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setDoc(data);
      if (data.status === "signed") setSigned(true);
    } catch (e: any) {
      setError(e.message || "שגיאה בטעינת המסמך");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
  }, [doc]);

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

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    
    setSubmitting(true);
    try {
      const signatureData = canvas.toDataURL("image/png");
      const { data, error: fnError } = await supabase.functions.invoke("sign-document", {
        body: { action: "sign", token, signature_data: signatureData },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSigned(true);
    } catch (e: any) {
      alert(e.message || "שגיאה בחתימה");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <div className="text-center space-y-4">
          <FileText className="w-16 h-16 mx-auto text-gray-400" />
          <h1 className="text-xl font-bold text-gray-700">{error}</h1>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">המסמך נחתם בהצלחה!</h1>
          <p className="text-gray-500">תודה רבה, החתימה נשמרה במערכת.</p>
        </div>
      </div>
    );
  }

  const details = doc?.rental_details || {};

  return (
    <div className="min-h-screen bg-gray-50 p-4" dir="rtl">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-4">
          <img src={logoImg} alt="לוגו" className="h-16 mx-auto rounded-xl" />
          <h1 className="text-xl font-bold text-gray-800">
            {DOC_LABELS[doc?.document_type] || "מסמך לחתימה"}
          </h1>
        </div>

        {/* Customer/Vehicle Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">פרטי ההשכרה</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">שם:</span>
              <p className="font-medium">{details.customer_name || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">ת.ז:</span>
              <p className="font-medium">{details.customer_id_number || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">טלפון:</span>
              <p className="font-medium">{details.customer_phone || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">רכב:</span>
              <p className="font-medium">
                {details.vehicle_manufacturer} {details.vehicle_model} {details.vehicle_year}
              </p>
            </div>
            <div>
              <span className="text-gray-500">לוחית:</span>
              <p className="font-medium">{details.vehicle_plate || "-"}</p>
            </div>
            <div>
              <span className="text-gray-500">תאריכים:</span>
              <p className="font-medium">{details.start_date} - {details.end_date}</p>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              תוכן המסמך
            </h2>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto">
            <DocumentContent documentType={doc?.document_type} details={details} />
          </div>
        </div>

        {/* Signature */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">חתימה</h2>
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
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
            disabled={!hasSignature || submitting}
            onClick={handleSign}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שומר חתימה...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 ml-2" />
                אישור וחתימה
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
