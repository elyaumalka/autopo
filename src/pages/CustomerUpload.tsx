import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Check, Loader2, Camera, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CustomerUpload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"front" | "back" | "passport" | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [passportUrl, setPassportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    loadCustomer();
  }, [token]);

  const loadCustomer = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("customer-upload", {
        body: { action: "get-customer", token },
      });
      if (fnErr || data?.error) throw new Error(data?.error || "שגיאה");
      setCustomer(data);
      setFrontUrl(data.license_front_url);
      setBackUrl(data.license_back_url);
      setPassportUrl(data.passport_url);
    } catch (e: any) {
      setError(e.message || "קישור לא תקין");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (side: "front" | "back" | "passport") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(side);
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const { data, error: fnErr } = await supabase.functions.invoke("customer-upload", {
            body: {
              action: "upload-license",
              token,
              file_data: reader.result,
              file_name: file.name,
              side,
            },
          });
          if (fnErr || data?.error) throw new Error(data?.error || "שגיאה בהעלאה");
          if (side === "front") setFrontUrl(data.url);
          else if (side === "back") setBackUrl(data.url);
          else setPassportUrl(data.url);
          const labels: Record<string, string> = { front: "קדמי", back: "אחורי", passport: "דרכון" };
          toast({ title: `${labels[side]} הועלה בהצלחה!` });
          setUploading(null);
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        toast({ title: "שגיאה", description: err.message, variant: "destructive" });
        setUploading(null);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4" dir="rtl">
        <Card className="p-8 text-center max-w-sm">
          <p className="text-xl font-bold text-destructive mb-2">שגיאה</p>
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  const isForeign = customer?.is_foreign;
  const allDone = frontUrl && backUrl && (!isForeign || passportUrl);

  const UploadCard = ({ title, url, side, isUploading }: { title: string; url: string | null; side: "front" | "back" | "passport"; isUploading: boolean }) => (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">{title}</h2>
        {url && <Check className="w-5 h-5 text-green-600" />}
      </div>
      {url ? (
        <div className="space-y-3">
          <img src={url} alt={title} className="w-full h-48 object-cover rounded-lg border" />
          <Button variant="outline" className="w-full" onClick={() => handleUpload(side)} disabled={isUploading}>
            {isUploading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Camera className="w-4 h-4 ml-2" />}
            צלם מחדש
          </Button>
        </div>
      ) : (
        <Button className="w-full h-32 border-2 border-dashed bg-background hover:bg-muted/50" variant="outline" onClick={() => handleUpload(side)} disabled={isUploading}>
          {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <div className="flex flex-col items-center gap-2">
              <Camera className="w-8 h-8 text-muted-foreground" />
              <span className="text-muted-foreground">לחץ לצילום או העלאה</span>
            </div>
          )}
        </Button>
      )}
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">העלאת מסמכים</h1>
          <p className="text-muted-foreground mt-1">
            שלום {customer?.first_name}, אנא צלם/י את המסמכים הנדרשים
          </p>
          {isForeign && (
            <div className="flex items-center justify-center gap-1 mt-2 text-blue-600 text-sm">
              <Globe className="w-4 h-4" />
              נדרש רישיון נהיגה + דרכון
            </div>
          )}
        </div>

        <UploadCard title="רישיון נהיגה - צד קדמי" url={frontUrl} side="front" isUploading={uploading === "front"} />
        <UploadCard title="רישיון נהיגה - צד אחורי" url={backUrl} side="back" isUploading={uploading === "back"} />
        
        {isForeign && (
          <UploadCard title="דרכון" url={passportUrl} side="passport" isUploading={uploading === "passport"} />
        )}

        {allDone && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">תודה רבה! כל המסמכים הועלו בהצלחה</p>
          </div>
        )}
      </div>
    </div>
  );
}
