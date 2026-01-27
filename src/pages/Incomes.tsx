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
import { Plus, Search, Filter, DollarSign } from "lucide-react";
import { formatShortDate, formatCurrency } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Income = Database["public"]["Tables"]["incomes"]["Row"];

const incomeTypes = ["השכרה", "קילומטרז׳ נוסף", "דוח תנועה", "כביש 6", "נזק", "אחר"] as const;
const paymentMethods = ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית"] as const;

export default function Incomes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: incomes, isLoading } = useQuery({
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createIncome = useMutation({
    mutationFn: async (income: Partial<Income>) => {
      const { data, error } = await supabase.from("incomes").insert(income as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      setDialogOpen(false);
      toast({ title: "ההכנסה נוספה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בהוספת הכנסה", description: error.message, variant: "destructive" });
    },
  });

  const filteredIncomes = incomes?.filter((income) => {
    const matchesSearch =
      income.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      income.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || income.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalAmount = filteredIncomes?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="הכנסות"
        subtitle="ניהול וצפייה בהכנסות"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                הוסף הכנסה
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוספת הכנסה חדשה</DialogTitle>
              </DialogHeader>
              <IncomeForm onSubmit={(data) => createIncome.mutate(data)} isLoading={createIncome.isPending} />
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Card */}
      <div className="mb-6 bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-gray-600">סה"כ הכנסות (לפי סינון)</span>
          </div>
          <span className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="חיפוש לפי לקוח, חשבונית או הערות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <Filter className="ml-2 h-4 w-4" />
                <SelectValue placeholder="סוג הכנסה" />
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
        </div>
        <div className="p-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : filteredIncomes && filteredIncomes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>חשבונית</TableHead>
                  <TableHead>אמצעי תשלום</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead>סכום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncomes.map((income) => (
                  <TableRow key={income.id} className="hover:bg-gray-50">
                    <TableCell>{formatShortDate(income.date)}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                        {income.type}
                      </span>
                    </TableCell>
                    <TableCell>{income.customer_name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{income.invoice_number || "-"}</TableCell>
                    <TableCell>{income.payment_method || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{income.notes || "-"}</TableCell>
                    <TableCell className="font-bold text-green-600">{formatCurrency(income.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="אין הכנסות" description="לא נמצאו הכנסות במערכת" />
          )}
        </div>
      </div>
    </div>
  );
}

interface IncomeFormProps {
  onSubmit: (data: Partial<Income>) => void;
  isLoading: boolean;
}

function IncomeForm({ onSubmit, isLoading }: IncomeFormProps) {
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: "השכרה" as typeof incomeTypes[number],
    amount: "",
    customer_name: "",
    invoice_number: "",
    payment_method: "אשראי" as typeof paymentMethods[number],
    notes: "",
  });

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
      customer_name: formData.customer_name || null,
      invoice_number: formData.invoice_number || null,
      payment_method: formData.payment_method,
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
          <Label>סוג הכנסה</Label>
          <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
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
        <div className="space-y-2">
          <Label>שם לקוח</Label>
          <Input
            placeholder="שם הלקוח"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>מספר חשבונית</Label>
          <Input
            placeholder="מספר חשבונית"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
          />
        </div>
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
