import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Receipt, TrendingDown, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

const expenseTypes = ["דלק", "טיפול", "ביטוח", "רישוי", "תיקון", "שטיפה", "חניה", "כביש 6", "הוצאה קבועה", "אחר"] as const;
const paymentMethods = ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית"] as const;

export default function Expenses() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filterType, setFilterType] = useState("all");
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (expense: Partial<Expense>) => {
      const { data, error } = await supabase.from("expenses").insert(expense as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsOpen(false);
      setSelectedExpense(null);
      toast({ title: "ההוצאה נשמרה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בשמירת הוצאה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Expense> }) => {
      const { error } = await supabase.from("expenses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsOpen(false);
      setSelectedExpense(null);
      toast({ title: "ההוצאה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון הוצאה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "ההוצאה נמחקה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקת הוצאה", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const vehicle_id = formData.get("vehicle_id") as string || null;
    const vehicle = vehicles.find((v) => v.id === vehicle_id);

    const data: Partial<Expense> = {
      date: formData.get("date") as string,
      type: formData.get("type") as any,
      amount: parseFloat(formData.get("amount") as string),
      payment_method: (formData.get("payment_method") as any) || null,
      description: (formData.get("description") as string) || null,
      is_recurring: formData.get("is_recurring") === "on",
      vehicle_id: vehicle_id || null,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
    };

    if (selectedExpense) {
      updateMutation.mutate({ id: selectedExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Calculate stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyTotal = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const yearlyTotal = expenses
    .filter((e) => new Date(e.date).getFullYear() === currentYear)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const recurringTotal = expenses
    .filter((e) => e.is_recurring)
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const filteredExpenses = filterType === "all" 
    ? expenses 
    : expenses.filter((e) => e.type === filterType);

  const columns = [
    {
      header: "תאריך",
      cell: (row: Expense) => row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-",
    },
    {
      header: "סוג",
      cell: (row: Expense) => (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
          {row.type}
        </span>
      ),
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
      header: "קבועה",
      cell: (row: Expense) => row.is_recurring ? (
        <span className="text-green-600">✓</span>
      ) : null,
    },
    {
      header: "פעולות",
      cell: (row: Expense) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedExpense(row);
              setIsOpen(true);
            }}
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
      <PageHeader
        title="הוצאות"
        subtitle={`הוצאות החודש: ₪${monthlyTotal.toLocaleString()}`}
        action={
          <Button onClick={() => { setSelectedExpense(null); setIsOpen(true); }}>
            הוצאה חדשה
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="הוצאות החודש"
          value={`₪${monthlyTotal.toLocaleString()}`}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="סה״כ שנתי"
          value={`₪${yearlyTotal.toLocaleString()}`}
          icon={Receipt}
          color="orange"
        />
        <StatCard
          title="הוצאות קבועות"
          value={`₪${recurringTotal.toLocaleString()}`}
          icon={Receipt}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="סינון לפי סוג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {expenseTypes.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filteredExpenses.length > 0 ? (
        <DataTable columns={columns} data={filteredExpenses} />
      ) : (
        <EmptyState title="לא נמצאו הוצאות" description="לא נמצאו הוצאות במערכת" />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedExpense ? "עריכת הוצאה" : "הוצאה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>רכב</Label>
              <Select name="vehicle_id" defaultValue={selectedExpense?.vehicle_id || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר רכב (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא רכב</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.manufacturer} {v.model} - {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סוג *</Label>
                <Select name="type" defaultValue={selectedExpense?.type || "אחר"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>סכום *</Label>
                <Input
                  name="amount"
                  type="number"
                  defaultValue={selectedExpense?.amount || ""}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך *</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={selectedExpense?.date || format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
              <div>
                <Label>אמצעי תשלום</Label>
                <Select name="payment_method" defaultValue={selectedExpense?.payment_method || ""}>
                  <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea
                name="description"
                defaultValue={selectedExpense?.description || ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_recurring"
                name="is_recurring"
                defaultChecked={selectedExpense?.is_recurring || false}
              />
              <Label htmlFor="is_recurring">הוצאה קבועה/חוזרת</Label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {selectedExpense ? "עדכון" : "שמירה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
