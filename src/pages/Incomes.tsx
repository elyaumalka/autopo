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
import { DollarSign, TrendingUp, Calendar, Edit, Trash2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";
import { he } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Income = Tables<"incomes">;
type Customer = Tables<"customers">;

const incomeTypes = ["השכרה", "קילומטרז׳ נוסף", "דוח תנועה", "כביש 6", "נזק", "אחר"] as const;
const paymentMethods = ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית"] as const;

export default function Incomes() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formType, setFormType] = useState<string>("השכרה");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("אשראי");
  const queryClient = useQueryClient();

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Income[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Income>) => {
      const { error } = await supabase.from("incomes").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      setIsOpen(false);
      setEditingIncome(null);
      toast({ title: "ההכנסה נוספה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בהוספת הכנסה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Income> }) => {
      const { error } = await supabase.from("incomes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      setIsOpen(false);
      setEditingIncome(null);
      toast({ title: "ההכנסה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון הכנסה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      toast({ title: "ההכנסה נמחקה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקת הכנסה", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer = customers.find((c) => c.id === formCustomerId);

    const data: Partial<Income> = {
      amount: parseFloat(formData.get("amount") as string),
      date: formData.get("date") as string,
      type: formType as any,
      payment_method: formPaymentMethod as any,
      customer_id: formCustomerId && formCustomerId !== "none" ? formCustomerId : null,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
    };

    if (editingIncome) {
      updateMutation.mutate({ id: editingIncome.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openNewDialog = () => {
    setEditingIncome(null);
    setFormCustomerId("");
    setFormType("השכרה");
    setFormPaymentMethod("אשראי");
    setIsOpen(true);
  };

  const openEditDialog = (income: Income) => {
    setEditingIncome(income);
    setFormCustomerId(income.customer_id || "");
    setFormType(income.type || "השכרה");
    setFormPaymentMethod(income.payment_method || "אשראי");
    setIsOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const months = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: endOfYear(new Date()),
  });

  // Filter incomes
  const filteredIncomes = incomes.filter((income) => {
    const incomeDate = new Date(income.date);
    const matchesMonth = selectedMonth === "all" || incomeDate.getMonth() === parseInt(selectedMonth);
    const matchesType = selectedType === "all" || income.type === selectedType;
    return matchesMonth && matchesType;
  });

  // Calculate stats
  const totalYearly = incomes
    .filter((i) => new Date(i.date).getFullYear() === currentYear)
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  const currentMonth = new Date().getMonth();
  const monthlyTotal = incomes
    .filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  // Monthly chart data
  const monthlyData = months.map((month) => {
    const monthIncomes = incomes.filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() === month.getMonth() && d.getFullYear() === currentYear;
    });
    return {
      name: format(month, "MMM", { locale: he }),
      amount: monthIncomes.reduce((sum, i) => sum + (i.amount || 0), 0),
    };
  });

  // Type breakdown
  const typeBreakdown: Record<string, number> = {};
  filteredIncomes.forEach((income) => {
    const type = income.type || "אחר";
    typeBreakdown[type] = (typeBreakdown[type] || 0) + (income.amount || 0);
  });
  const pieData = Object.entries(typeBreakdown).map(([name, value]) => ({ name, value }));
  const COLORS = ["#0891b2", "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc", "#cffafe"];

  const columns = [
    {
      header: "תאריך",
      cell: (row: Income) => (row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"),
    },
    {
      header: "לקוח",
      accessor: "customer_name" as keyof Income,
    },
    {
      header: "סוג",
      cell: (row: Income) => (
        <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm">
          {row.type}
        </span>
      ),
    },
    {
      header: "אמצעי תשלום",
      accessor: "payment_method" as keyof Income,
    },
    {
      header: "סכום",
      cell: (row: Income) => (
        <span className="font-bold text-green-600">₪{row.amount?.toLocaleString() || 0}</span>
      ),
    },
    {
      header: "פעולות",
      cell: (row: Income) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(row)}>
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
        title="הכנסות"
        subtitle={`סה"כ השנה: ₪${totalYearly.toLocaleString()}`}
        action={
          <Button onClick={openNewDialog}>
            הכנסה חדשה
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="הכנסות החודש"
          value={`₪${monthlyTotal.toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="סה״כ שנתי"
          value={`₪${totalYearly.toLocaleString()}`}
          icon={TrendingUp}
          color="cyan"
        />
        <StatCard
          title="ממוצע חודשי"
          value={`₪${Math.round(totalYearly / (currentMonth + 1)).toLocaleString()}`}
          icon={Calendar}
          color="blue"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6">
          <h3 className="font-semibold mb-4">הכנסות לפי חודש</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => [`₪${value.toLocaleString()}`, "הכנסה"]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="amount" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold mb-4">התפלגות לפי סוג</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₪${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="חודש" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החודשים</SelectItem>
            {months.map((month, i) => (
              <SelectItem key={i} value={i.toString()}>
                {format(month, "MMMM", { locale: he })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סוג" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {incomeTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filteredIncomes.length > 0 ? (
        <DataTable columns={columns} data={filteredIncomes} />
      ) : (
        <EmptyState title="לא נמצאו הכנסות" description="לא נמצאו הכנסות במערכת" />
      )}

      {/* Add/Edit Income Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIncome ? "עריכת הכנסה" : "הכנסה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>לקוח (אופציונלי)</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח או השאר ריק" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא לקוח</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סכום *</Label>
                <Input
                  name="amount"
                  type="number"
                  defaultValue={editingIncome?.amount || ""}
                  required
                />
              </div>
              <div>
                <Label>תאריך *</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={editingIncome?.date || format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סוג *</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>אמצעי תשלום</Label>
                <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר" />
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
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {editingIncome ? "עדכון" : "שמירה"}
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
