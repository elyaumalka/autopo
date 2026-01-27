import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Upload, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function VehiclePhotos() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [searchParams] = useSearchParams();
  const rentalId = searchParams.get("rental");
  const customerName = searchParams.get("customer");
  const vehicleDetails = searchParams.get("vehicle");
  const date = searchParams.get("date");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];
      
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${rentalId || 'rental'}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `rental-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("vehicle-images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("vehicle-images")
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }
      
      setPhotos(prev => [...prev, ...uploadedUrls]);
      toast({ title: `${files.length} תמונות הועלו בהצלחה` });
    } catch (error) {
      console.error(error);
      toast({ title: "שגיאה בהעלאת התמונות", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = async () => {
    if (photos.length === 0) {
      toast({ title: "נא להעלות לפחות תמונה אחת", variant: "destructive" });
      return;
    }

    if (!rentalId) {
      toast({ title: "לא נמצא מזהה השכרה", variant: "destructive" });
      return;
    }

    try {
      // Get current rental notes
      const { data: rental } = await supabase
        .from("rentals")
        .select("notes")
        .eq("id", rentalId)
        .single();

      const currentNotes = rental?.notes || "";
      const photoNotes = `תמונות רכב בתחילת השכרה:\n${photos.join("\n")}`;
      const newNotes = currentNotes ? `${currentNotes}\n\n${photoNotes}` : photoNotes;

      // Update rental with photos
      const { error } = await supabase
        .from("rentals")
        .update({ notes: newNotes })
        .eq("id", rentalId);

      if (error) throw error;

      toast({ title: "התמונות נשמרו בהצלחה!" });
      
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (error) {
      console.error(error);
      toast({ title: "שגיאה בשמירת התמונות", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <div className="text-center mb-6">
            <Camera className="w-16 h-16 mx-auto mb-4 text-cyan-600" />
            <h1 className="text-2xl font-bold mb-2">צילום תמונות רכב</h1>
            <div className="text-gray-600 space-y-1">
              <p className="font-medium">שוכר: {customerName || "-"}</p>
              <p>רכב: {vehicleDetails || "-"}</p>
              <p>תאריך: {date || "-"}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="photo-input"
                disabled={uploading}
              />
              <label htmlFor="photo-input" className="cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-12 h-12 mx-auto mb-3 text-cyan-600 animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                )}
                <p className="text-lg font-medium mb-1">
                  {uploading ? "מעלה תמונות..." : "לחץ לצילום או העלאת תמונות"}
                </p>
                <p className="text-sm text-gray-500">צלם את הרכב מכל הזוויות</p>
              </label>
            </div>

            {photos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">תמונות שהועלו ({photos.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((url, i) => (
                    <div key={i} className="relative aspect-square">
                      <img 
                        src={url} 
                        alt={`תמונה ${i + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleComplete}
              disabled={photos.length === 0 || uploading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-lg py-6"
            >
              {uploading ? "מעלה..." : "סיים והשלם"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
