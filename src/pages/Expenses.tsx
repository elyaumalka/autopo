import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Filter, TrendingDown } from "lucide-react";
import { formatShortDate, formatCurrency } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

const expenseTypes = ["דלק", "טיפול", "ביטוח", "רישוי", "תיקון", "שטיפה", "חניה", "כביש 6", "הוצאה קבועה", "אחר"] as const;
const paymentMethods = ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית"] as const;

export default function Expenses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: expenses, isLoading } = useQuery({
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

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createExpense = useMutation({
    mutationFn: async (expense: Partial<Expense>) => {
      const { data, error } = await supabase.from("expenses").insert(expense as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setDialogOpen(false);
      toast({ title: "ההוצאה נוספה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בהוספת הוצאה", description: error.message, variant: "destructive" });
    },
  });

  const filteredExpenses = expenses?.filter((expense) => {
    const matchesSearch =
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vehicle_details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || expense.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalAmount = filteredExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="הוצאות"
        subtitle="ניהול וצפייה בהוצאות"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף הוצאה
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוספת הוצאה חדשה</DialogTitle>
              </DialogHeader>
              <ExpenseForm
                vehicles={vehicles || []}
                onSubmit={(data) => createExpense.mutate(data)}
                isLoading={createExpense.isPending}
              />
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <span className="text-muted-foreground">סה"כ הוצאות (לפי סינון)</span>
            </div>
            <span className="text-2xl font-bold text-red-600">{formatCurrency(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי תיאור, רכב או הערות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <Filter className="ml-2 h-4 w-4" />
                <SelectValue placeholder="סוג הוצאה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                {expenseTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>רכב</TableHead>
                  <TableHead>אמצעי תשלום</TableHead>
                  <TableHead>חוזר</TableHead>
                  <TableHead>סכום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatShortDate(expense.date)}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
                        {expense.type}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{expense.description || "-"}</TableCell>
                    <TableCell>{expense.vehicle_details || "-"}</TableCell>
                    <TableCell>{expense.payment_method || "-"}</TableCell>
                    <TableCell>{expense.is_recurring ? "✓" : "-"}</TableCell>
                    <TableCell className="font-medium text-red-600">{formatCurrency(expense.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="אין הוצאות" description="לא נמצאו הוצאות במערכת" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ExpenseFormProps {
  vehicles: Vehicle[];
  onSubmit: (data: Partial<Expense>) => void;
  isLoading: boolean;
}

function ExpenseForm({ vehicles, onSubmit, isLoading }: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: "דלק" as typeof expenseTypes[number],
    amount: "",
    vehicle_id: "",
    description: "",
    payment_method: "אשראי" as typeof paymentMethods[number],
    is_recurring: false,
    notes: "",
  });

  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }
    onSubmit({
      date: formData.date,
      type: formData.type,
      amount: parseFloat(formData.amount),
      vehicle_id: formData.vehicle_id || null,
      vehicle_details: selectedVehicle
        ? `${selectedVehicle.manufacturer} ${selectedVehicle.model} - ${selectedVehicle.license_plate}`
        : null,
      description: formData.description || null,
      payment_method: formData.payment_method,
      is_recurring: formData.is_recurring,
      notes: formData.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>תאריך</Label>
          <Input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>סוג הוצאה</Label>
          <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expenseTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>סכום</Label>
          <Input
            type="number"
            placeholder="0"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>אמצעי תשלום</Label>
          <Select value={formData.payment_method} onValueChange={(v: any) => setFormData({ ...formData, payment_method: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>רכב (אופציונלי)</Label>
          <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="בחר רכב" />
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
        <div className="space-y-2 md:col-span-2">
          <Label>תיאור</Label>
          <Input
            placeholder="תיאור ההוצאה"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="recurring"
          checked={formData.is_recurring}
          onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
        />
        <Label htmlFor="recurring">הוצאה חוזרת</Label>
      </div>
      <div className="space-y-2">
        <Label>הערות</Label>
        <Textarea
          placeholder="הערות נוספות..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "שומר..." : "שמור"}
        </Button>
      </div>
    </form>
  );
}
