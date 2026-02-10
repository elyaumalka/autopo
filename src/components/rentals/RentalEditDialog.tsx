import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Save, Upload, X, Image as ImageIcon, FileText, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

type Rental = Tables<"rentals">;

interface RentalEditDialogProps {
  rental: Rental | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function RentalEditDialog({
  rental,
  isOpen,
  onClose,
}: RentalEditDialogProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    base_cost: 0,
    additional_charges: 0,
    additional_charges_details: "",
    paid_amount: 0,
    start_km: 0,
    end_km: 0,
    start_date: "",
    planned_end_date: "",
    actual_end_date: "",
    start_time: "",
    planned_end_time: "",
    actual_end_time: "",
    notes: "",
    status: "פעיל" as string,
    invoice_number: "",
    credit_hold: 0,
  });

  useEffect(() => {
    if (rental) {
      setFormData({
        base_cost: rental.base_cost || 0,
        additional_charges: rental.additional_charges || 0,
        additional_charges_details: rental.additional_charges_details || "",
        paid_amount: rental.paid_amount || 0,
        start_km: rental.start_km || 0,
        end_km: rental.end_km || 0,
        start_date: rental.start_date || "",
        planned_end_date: rental.planned_end_date || "",
        actual_end_date: rental.actual_end_date || "",
        start_time: rental.start_time || "",
        planned_end_time: rental.planned_end_time || "",
        actual_end_time: rental.actual_end_time || "",
        notes: rental.notes || "",
        status: rental.status || "פעיל",
        invoice_number: rental.invoice_number || "",
        credit_hold: rental.credit_hold || 0,
      });
      const rentalPhotos = (rental as any).photos;
      setPhotos(Array.isArray(rentalPhotos) ? rentalPhotos : []);
    }
  }, [rental]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !rental) return;

    setIsUploading(true);
    const newPhotos = [...photos];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `rentals/${rental.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const { error } = await supabase.storage
          .from("customer-documents")
          .upload(path, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("customer-documents")
          .getPublicUrl(path);

        newPhotos.push(urlData.publicUrl);
      }

      setPhotos(newPhotos);
      toast({ title: "התמונות הועלו בהצלחה" });
    } catch (error) {
      toast({ title: "שגיאה בהעלאת תמונות", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!rental) return;
    setIsSaving(true);

    const totalCost = formData.base_cost + formData.additional_charges + (rental.extra_km_cost || 0);
    const remaining = totalCost - formData.paid_amount;

    try {
      const { error } = await supabase
        .from("rentals")
        .update({
          base_cost: formData.base_cost,
          additional_charges: formData.additional_charges,
          additional_charges_details: formData.additional_charges_details,
          paid_amount: formData.paid_amount,
          total_cost: totalCost,
          remaining_payment: remaining >= 0 ? remaining : 0,
          start_km: formData.start_km,
          end_km: formData.end_km || null,
          start_date: formData.start_date,
          planned_end_date: formData.planned_end_date || null,
          actual_end_date: formData.actual_end_date || null,
          start_time: formData.start_time || null,
          planned_end_time: formData.planned_end_time || null,
          actual_end_time: formData.actual_end_time || null,
          notes: formData.notes || null,
          status: formData.status as any,
          invoice_number: formData.invoice_number || null,
          credit_hold: formData.credit_hold || null,
          photos: photos,
        })
        .eq("id", rental.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: "ההשכרה עודכנה בהצלחה" });
      onClose();
    } catch (error) {
      toast({ title: "שגיאה בעדכון ההשכרה", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!rental) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת השכרה - {rental.customer_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="costs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="costs" className="gap-2">
              <DollarSign className="h-4 w-4" />
              עלויות
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              פרטים
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-2">
              <Camera className="h-4 w-4" />
              תמונות
            </TabsTrigger>
          </TabsList>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>עלות בסיס (₪)</Label>
                <Input
                  type="number"
                  value={formData.base_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, base_cost: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>חיובים נוספים (₪)</Label>
                <Input
                  type="number"
                  value={formData.additional_charges}
                  onChange={(e) =>
                    setFormData({ ...formData, additional_charges: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>פירוט חיובים נוספים</Label>
                <Textarea
                  placeholder="כביש 6, דלק, נזקים..."
                  value={formData.additional_charges_details}
                  onChange={(e) =>
                    setFormData({ ...formData, additional_charges_details: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>סכום ששולם (₪)</Label>
                <Input
                  type="number"
                  value={formData.paid_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, paid_amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>עיכבון אשראי (₪)</Label>
                <Input
                  type="number"
                  value={formData.credit_hold}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_hold: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>מספר חשבונית</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) =>
                    setFormData({ ...formData, invoice_number: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Cost Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>עלות בסיס:</span>
                <span>₪{formData.base_cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>ק"מ נוסף:</span>
                <span>₪{(rental.extra_km_cost || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>חיובים נוספים:</span>
                <span>₪{formData.additional_charges.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>סה"כ:</span>
                <span>
                  ₪{(formData.base_cost + formData.additional_charges + (rental.extra_km_cost || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>שולם:</span>
                <span>₪{formData.paid_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-destructive">
                <span>נותר:</span>
                <span>
                  ₪{Math.max(0, formData.base_cost + formData.additional_charges + (rental.extra_km_cost || 0) - formData.paid_amount).toLocaleString()}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך התחלה</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
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
              <div>
                <Label>תאריך סיום מתוכנן</Label>
                <Input
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>שעת סיום מתוכננת</Label>
                <Input
                  type="time"
                  value={formData.planned_end_time}
                  onChange={(e) => setFormData({ ...formData, planned_end_time: e.target.value })}
                />
              </div>
              <div>
                <Label>תאריך סיום בפועל</Label>
                <Input
                  type="date"
                  value={formData.actual_end_date}
                  onChange={(e) => setFormData({ ...formData, actual_end_date: e.target.value })}
                />
              </div>
              <div>
                <Label>שעת סיום בפועל</Label>
                <Input
                  type="time"
                  value={formData.actual_end_time}
                  onChange={(e) => setFormData({ ...formData, actual_end_time: e.target.value })}
                />
              </div>
              <div>
                <Label>ק"מ התחלה</Label>
                <Input
                  type="number"
                  value={formData.start_km}
                  onChange={(e) =>
                    setFormData({ ...formData, start_km: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>ק"מ סיום</Label>
                <Input
                  type="number"
                  value={formData.end_km}
                  onChange={(e) =>
                    setFormData({ ...formData, end_km: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>סטטוס</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="פעיל">פעיל</SelectItem>
                    <SelectItem value="הושלם">הושלם</SelectItem>
                    <SelectItem value="בוטל">בוטל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>הערות</Label>
              <Textarea
                placeholder="הערות כלליות..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-4">
            <div>
              <Label className="mb-2 block">העלאת תמונות</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={isUploading}
                  onClick={() => document.getElementById("rental-photo-upload")?.click()}
                >
                  <Upload className="w-4 h-4 ml-2" />
                  {isUploading ? "מעלה..." : "בחר תמונות"}
                </Button>
                <input
                  id="rental-photo-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photos.map((url, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border">
                    <img
                      src={url}
                      alt={`תמונה ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      פתח בחלון חדש
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <ImageIcon className="w-12 h-12 mb-2" />
                <p>אין תמונות להשכרה זו</p>
                <p className="text-sm">לחץ על "בחר תמונות" להעלאה</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            <Save className="w-4 h-4 ml-2" />
            {isSaving ? "שומר..." : "שמור שינויים"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
