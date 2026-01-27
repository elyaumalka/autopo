import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Upload, Loader2, FileSpreadsheet, Edit, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Expense = Tables<"expenses">;
type Vehicle = Tables<"vehicles">;
type Rental = Tables<"rentals">;

interface FormData {
  vehicle_id?: string;
  date?: string;
  amount?: string;
  description?: string;
}

export default function HighwayBills() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [formData, setFormData] = useState<FormData>({});
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["highway-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("type", "כביש 6")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*");
      if (error) throw error;
      return data as Rental[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Expense>) => {
      const { error } = await supabase.from("expenses").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highway-expenses"] });
      setIsOpen(false);
      setFormData({});
      toast({ title: "החיוב נוסף בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בהוספת חיוב", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Expense> }) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highway-expenses"] });
      setIsOpen(false);
      setFormData({});
      setEditingExpense(null);
      toast({ title: "החיוב עודכן בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון חיוב", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highway-expenses"] });
      toast({ title: "החיוב נמחק בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקת חיוב", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const vehicle = vehicles.find((v) => v.id === formData.vehicle_id);
    const data: Partial<Expense> = {
      type: "כביש 6",
      vehicle_id: formData.vehicle_id || null,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
      date: formData.date || null,
      amount: parseFloat(formData.amount || "0"),
      description: formData.description || null,
      payment_method: "אשראי",
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      vehicle_id: expense.vehicle_id || "",
      date: expense.date || "",
      amount: String(expense.amount || ""),
      description: expense.description || "",
    });
    setIsOpen(true);
  };

  const openNewDialog = () => {
    setEditingExpense(null);
    setFormData({});
    setIsOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Upload file to Supabase storage
      const fileName = `highway-bills/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Note: Full Excel parsing and AI extraction would require an edge function
      // For now, show a message that the file was uploaded
      toast({
        title: "הקובץ הועלה בהצלחה",
        description: "עיבוד קבצי Excel אוטומטי יופעל בגרסה הבאה. לעת עתה, הוסף חיובים ידנית.",
      });

      setUploadDialog(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: "שגיאה בעיבוד הקובץ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const columns = [
    {
      header: "תאריך",
      cell: (row: Expense) => row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-",
    },
    {
      header: "רכב",
      accessor: "vehicle_details" as keyof Expense,
    },
    {
      header: "תיאור",
      accessor: "description" as keyof Expense,
    },
    {
      header: "סכום",
      cell: (row: Expense) => (
        <span className="font-bold text-red-600">₪{row.amount?.toLocaleString() || 0}</span>
      ),
    },
    {
      header: "פעולות",
      cell: (row: Expense) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditDialog(row)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-red-500 hover:text-red-700"
            onClick={() => deleteMutation.mutate(row.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">כביש 6</h1>
          <p className="text-gray-500 mt-1">סה"כ: ₪{totalAmount.toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setUploadDialog(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Upload className="w-5 h-5 ml-2" />
            העלה קובץ מכביש 6
          </Button>
          <Button onClick={openNewDialog} className="bg-cyan-600 hover:bg-cyan-700">
            חיוב חדש
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : expenses.length > 0 ? (
        <DataTable columns={columns} data={expenses} />
      ) : (
        <EmptyState title="אין חיובי כביש 6" description="לא נמצאו חיובי כביש 6 במערכת" />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? "עריכת חיוב כביש 6" : "חיוב כביש 6 חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>רכב *</Label>
              <Select
                value={formData.vehicle_id || ""}
                onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר רכב" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.manufacturer} {v.model} - {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={formData.date || ""}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <Label>סכום *</Label>
              <Input
                type="number"
                value={formData.amount || ""}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label>תיאור</Label>
              <Input
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="פרטים נוספים"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!formData.vehicle_id || !formData.date || !formData.amount}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              {editingExpense ? "עדכן חיוב" : "הוסף חיוב"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Excel Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>העלאת קובץ חיובי כביש 6</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-4">
                העלה קובץ Excel מכביש 6 והמערכת תשייך אוטומטית ללקוחות לפי תאריך
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>מעבד קובץ...</span>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">💡 שדרוג עתידי</p>
              <p className="text-gray-700">
                ניתן להגדיר חיבור ישיר לכביש 6 באמצעות API שלהם לקבלת חיובים אוטומטית.
                זה כבר עובד בהרבה חברות השכרה. צור קשר לפרטים נוספים.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
