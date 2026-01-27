import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CheckCircle, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

export default function Sign() {
  const queryClient = useQueryClient();
  const [isSigned, setIsSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const documentType = urlParams.get("type");
  const bookingId = urlParams.get("id");
  const docUrl = urlParams.get("doc");

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      if (!bookingId) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();
      if (error) throw error;
      return data as Booking;
    },
    enabled: !!bookingId,
  });

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ["customer", booking?.customer_id],
    queryFn: async () => {
      if (!booking?.customer_id) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", booking.customer_id)
        .single();
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!booking?.customer_id,
  });

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", booking?.vehicle_id],
    queryFn: async () => {
      if (!booking?.vehicle_id) return null;
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", booking.vehicle_id)
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    enabled: !!booking?.vehicle_id,
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Booking> }) => {
      const { error } = await supabase.from("bookings").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    },
  });

  useEffect(() => {
    if (booking) {
      if (documentType === "contract" && booking.contract_signed) {
        setIsSigned(true);
      } else if (documentType === "declaration" && booking.declaration_signed) {
        setIsSigned(true);
      } else if (documentType === "waiver" && booking.waiver_signed) {
        setIsSigned(true);
      }
    }
  }, [booking, documentType]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }
  }, []);

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
    }
    setSignatureData(null);
  };

  const handleSign = async () => {
    if (!signatureData) {
      toast({ title: "נא לחתום על המסמך", variant: "destructive" });
      return;
    }

    if (!bookingId || !docUrl) {
      toast({ title: "מידע חסר", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Download original PDF
      const pdfResponse = await fetch(docUrl);
      const pdfBytes = await pdfResponse.arrayBuffer();

      // Load PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Embed signature image
      const signatureImageBytes = await fetch(signatureData).then((r) =>
        r.arrayBuffer()
      );
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

      // Get last page
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width } = lastPage.getSize();

      // Add signature to bottom of page
      const signatureWidth = 200;
      const signatureHeight = 100;
      lastPage.drawImage(signatureImage, {
        x: width / 2 - signatureWidth / 2,
        y: 80,
        width: signatureWidth,
        height: signatureHeight,
      });

      // Save signed PDF
      const signedPdfBytes = await pdfDoc.save();
      const signedPdfBlob = new Blob([new Uint8Array(signedPdfBytes)], { type: "application/pdf" });

      // Upload to Supabase storage
      const fileName = `signed_${documentType}_${bookingId}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(fileName, signedPdfBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("contracts")
        .getPublicUrl(uploadData.path);

      const signedPdfUrl = urlData.publicUrl;

      // Update booking with signed PDF URL
      const updateData: Partial<Booking> = {};
      if (documentType === "contract") {
        updateData.contract_signed = true;
        updateData.contract_url = signedPdfUrl;
      } else if (documentType === "declaration") {
        updateData.declaration_signed = true;
        updateData.declaration_url = signedPdfUrl;
      } else if (documentType === "waiver") {
        updateData.waiver_signed = true;
        updateData.waiver_url = signedPdfUrl;
      }

      await updateBookingMutation.mutateAsync({ id: bookingId, data: updateData });
      setIsSigned(true);
      toast({ title: "המסמך נחתם בהצלחה!" });
    } catch (error) {
      console.error("Error signing document:", error);
      toast({ title: "שגיאה בחתימה על המסמך", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDocumentTitle = () => {
    if (documentType === "contract") return "חוזה השכרת רכב";
    if (documentType === "declaration") return "תצהיר קבלת רכב";
    if (documentType === "waiver") return "כתב ויתור";
    return "מסמך";
  };

  const isLoading = bookingLoading || customerLoading || vehicleLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (!booking || !customer || !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">מסמך לא נמצא</h2>
          <p className="text-gray-500">לא הצלחנו למצוא את המסמך המבוקש</p>
        </div>
      </div>
    );
  }

  if (isSigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            המסמך נחתם בהצלחה!
          </h2>
          <p className="text-gray-500 mb-6">{getDocumentTitle()} נחתם ונשמר במערכת</p>
          <div className="bg-gray-50 rounded-lg p-4 text-right">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">שוכר:</span> {customer.first_name}{" "}
              {customer.last_name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">רכב:</span> {vehicle.manufacturer}{" "}
              {vehicle.model}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">תאריך חתימה:</span>{" "}
              {format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-l from-cyan-600 to-blue-700 text-white p-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">{getDocumentTitle()}</h1>
                <p className="text-cyan-100">נא לקרוא ולחתום על המסמך</p>
              </div>
            </div>
          </div>

          {/* Document Content */}
          <div className="p-6 border-b">
            {docUrl ? (
              <iframe
                src={docUrl}
                className="w-full h-[500px] border rounded-lg"
                title="document"
              />
            ) : (
              <div className="text-center text-gray-500 py-20">אין מסמך להצגה</div>
            )}
          </div>

          {/* Signature Section */}
          <div className="p-6 bg-gray-50">
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">חתמו כאן:</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4 ml-1" />
                    נקה חתימה
                  </Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
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
              <div className="text-sm text-gray-500">
                תאריך: {format(new Date(), "dd/MM/yyyy HH:mm")}
              </div>
              <Button
                onClick={handleSign}
                disabled={!signatureData || isSubmitting}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-lg h-12"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    חותם...
                  </>
                ) : (
                  "אישור וחתימה"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
