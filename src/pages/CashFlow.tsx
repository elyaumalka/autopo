import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function CashFlow() {
  const [monthsBack, setMonthsBack] = useState("6");

  const { data: cashFlowData, isLoading } = useQuery({
    queryKey: ["cashFlow", monthsBack],
    queryFn: async () => {
      const months = parseInt(monthsBack);
      const data = [];

      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
        const end = format(endOfMonth(monthDate), "yyyy-MM-dd");

        // Get incomes
        const { data: incomes } = await supabase
          .from("incomes")
          .select("amount")
          .gte("date", start)
          .lte("date", end);

        // Get expenses
        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .gte("date", start)
          .lte("date", end);

        const totalIncome = incomes?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0;
        const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

        data.push({
          month: format(monthDate, "MMMM yyyy", { locale: he }),
          shortMonth: format(monthDate, "MMM", { locale: he }),
          income: totalIncome,
          expenses: totalExpenses,
          profit: totalIncome - totalExpenses,
        });
      }

      return data;
    },
  });

  const totals = cashFlowData?.reduce(
    (acc, month) => ({
      income: acc.income + month.income,
      expenses: acc.expenses + month.expenses,
      profit: acc.profit + month.profit,
    }),
    { income: 0, expenses: 0, profit: 0 }
  ) || { income: 0, expenses: 0, profit: 0 };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="תזרים מזומנים"
        subtitle="סקירת הכנסות, הוצאות ורווחים"
        action={
          <Select value={monthsBack} onValueChange={setMonthsBack}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 חודשים</SelectItem>
              <SelectItem value="6">6 חודשים</SelectItem>
              <SelectItem value="12">12 חודשים</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">סה"כ הכנסות</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">סה"כ הוצאות</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.expenses)}</p>
                  </div>
                  <TrendingDown className="h-10 w-10 text-red-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">רווח נקי</p>
                    <p className={`text-2xl font-bold ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(totals.profit)}
                    </p>
                  </div>
                  <DollarSign className={`h-10 w-10 ${totals.profit >= 0 ? "text-green-200" : "text-red-200"}`} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>מגמת תזרים מזומנים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shortMonth" />
                    <YAxis tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => cashFlowData?.find((d) => d.shortMonth === label)?.month || label}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="הכנסות"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="הוצאות"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="רווח"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט חודשי</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>חודש</TableHead>
                    <TableHead>הכנסות</TableHead>
                    <TableHead>הוצאות</TableHead>
                    <TableHead>רווח נקי</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowData?.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell className="font-medium">{month.month}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(month.income)}</TableCell>
                      <TableCell className="text-red-600">{formatCurrency(month.expenses)}</TableCell>
                      <TableCell className={month.profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {formatCurrency(month.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>סה"כ</TableCell>
                    <TableCell className="text-green-600">{formatCurrency(totals.income)}</TableCell>
                    <TableCell className="text-red-600">{formatCurrency(totals.expenses)}</TableCell>
                    <TableCell className={totals.profit >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(totals.profit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
