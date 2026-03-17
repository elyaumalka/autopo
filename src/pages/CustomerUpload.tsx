import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Check, Loader2, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CustomerUpload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"front" | "back" | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);

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
    } catch (e: any) {
      setError(e.message || "קישור לא תקין");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (side: "front" | "back") => {
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
          else setBackUrl(data.url);
          toast({ title: `הצד ה${side === "front" ? "קדמי" : "אחורי"} הועלה בהצלחה!` });
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

  const allDone = frontUrl && backUrl;

  return (
    <div className="min-h-screen bg-muted/30 p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">העלאת רישיון נהיגה</h1>
          <p className="text-muted-foreground mt-1">
            שלום {customer?.first_name}, אנא צלם/י את שני צדי הרישיון
          </p>
        </div>

        {/* Front side */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">צד קדמי</h2>
            {frontUrl && <Check className="w-5 h-5 text-green-600" />}
          </div>
          {frontUrl ? (
            <div className="space-y-3">
              <img src={frontUrl} alt="צד קדמי" className="w-full h-48 object-cover rounded-lg border" />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleUpload("front")}
                disabled={uploading === "front"}
              >
                {uploading === "front" ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Camera className="w-4 h-4 ml-2" />}
                צלם מחדש
              </Button>
            </div>
          ) : (
            <Button
              className="w-full h-32 border-2 border-dashed bg-background hover:bg-muted/50"
              variant="outline"
              onClick={() => handleUpload("front")}
              disabled={uploading === "front"}
            >
              {uploading === "front" ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-muted-foreground">לחץ לצילום או העלאה</span>
                </div>
              )}
            </Button>
          )}
        </Card>

        {/* Back side */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">צד אחורי</h2>
            {backUrl && <Check className="w-5 h-5 text-green-600" />}
          </div>
          {backUrl ? (
            <div className="space-y-3">
              <img src={backUrl} alt="צד אחורי" className="w-full h-48 object-cover rounded-lg border" />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleUpload("back")}
                disabled={uploading === "back"}
              >
                {uploading === "back" ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Camera className="w-4 h-4 ml-2" />}
                צלם מחדש
              </Button>
            </div>
          ) : (
            <Button
              className="w-full h-32 border-2 border-dashed bg-background hover:bg-muted/50"
              variant="outline"
              onClick={() => handleUpload("back")}
              disabled={uploading === "back"}
            >
              {uploading === "back" ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-muted-foreground">לחץ לצילום או העלאה</span>
                </div>
              )}
            </Button>
          )}
        </Card>

        {allDone && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">תודה רבה! שני הצדדים הועלו בהצלחה</p>
          </div>
        )}
      </div>
    </div>
  );
}
