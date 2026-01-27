import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Banknote,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function CashFlow() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthStart = startOfMonth(new Date(selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedMonth));

  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ["incomes", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes")
        .select("*")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"))
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingIncomes || loadingExpenses;

  // Calculate totals by payment method
  const cashIn = incomes.filter(i => i.payment_method === "מזומן").reduce((sum, i) => sum + (i.amount || 0), 0);
  const creditIn = incomes.filter(i => i.payment_method === "אשראי").reduce((sum, i) => sum + (i.amount || 0), 0);
  const otherIn = incomes.filter(i => i.payment_method && !["מזומן", "אשראי"].includes(i.payment_method)).reduce((sum, i) => sum + (i.amount || 0), 0);

  const cashOut = expenses.filter(e => e.payment_method === "מזומן").reduce((sum, e) => sum + (e.amount || 0), 0);
  const creditOut = expenses.filter(e => e.payment_method === "אשראי").reduce((sum, e) => sum + (e.amount || 0), 0);
  const otherOut = expenses.filter(e => e.payment_method && !["מזומן", "אשראי"].includes(e.payment_method)).reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netCash = cashIn - cashOut;
  const netCredit = creditIn - creditOut;
  const netOther = otherIn - otherOut;
  const netTotal = totalIncome - totalExpenses;

  // All transactions sorted by date
  const allTransactions = [
    ...incomes.map(i => ({ ...i, transactionType: 'income' as const })),
    ...expenses.map(e => ({ ...e, transactionType: 'expense' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="תזרים מזומנים"
        subtitle="מעקב אחר כסף בקופה ומזומנים בפועל"
      />

      {/* Month Selector */}
      <div className="mb-6">
        <Label className="text-gray-700">בחר חודש</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48 mt-1"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              title="הכנסות בפועל"
              value={formatCurrency(totalIncome)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="סה״כ הוצאות"
              value={formatCurrency(totalExpenses)}
              icon={TrendingDown}
              color="red"
            />
            <StatCard
              title="רווח נקי"
              value={formatCurrency(netTotal)}
              icon={TrendingUp}
              color={netTotal >= 0 ? "green" : "red"}
            />
            <StatCard
              title="מזומן בקופה"
              value={formatCurrency(netCash)}
              icon={Wallet}
              color={netCash >= 0 ? "cyan" : "orange"}
            />
            <StatCard
              title="אשראי נטו"
              value={formatCurrency(netCredit)}
              icon={CreditCard}
              color="blue"
            />
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Cash */}
            <Card className="p-6 border-r-4 border-r-green-500 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Banknote className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">מזומן</h3>
                  <p className="text-sm text-gray-500">תנועות במזומן</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(cashIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">יצא:</span>
                  <span className="font-bold text-red-600">{formatCurrency(cashOut)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">יתרה:</span>
                  <span className={`font-bold text-lg ${netCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCash)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Credit */}
            <Card className="p-6 border-r-4 border-r-blue-500 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">אשראי</h3>
                  <p className="text-sm text-gray-500">תנועות באשראי</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(creditIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">יצא:</span>
                  <span className="font-bold text-red-600">{formatCurrency(creditOut)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">יתרה:</span>
                  <span className={`font-bold text-lg ${netCredit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCredit)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Other */}
            <Card className="p-6 border-r-4 border-r-purple-500 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Receipt className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">אחר</h3>
                  <p className="text-sm text-gray-500">צ'ק / העברה</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(otherIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-gray-600">יצא:</span>
                  <span className="font-bold text-red-600">{formatCurrency(otherOut)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold">יתרה:</span>
                  <span className={`font-bold text-lg ${netOther >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netOther)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Transactions */}
          <Card className="p-6 bg-white">
            <h3 className="font-semibold mb-4 text-lg text-gray-900">תנועות אחרונות</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allTransactions.map((transaction, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${transaction.transactionType === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {transaction.transactionType === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {transaction.transactionType === 'income' ? 'הכנסה' : 'הוצאה'} - {transaction.type}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.transactionType === 'income' 
                          ? (transaction.customer_name || '-')
                          : (transaction.vehicle_details || transaction.description || '-')}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {transaction.payment_method || '-'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-lg ml-4 ${transaction.transactionType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.transactionType === 'income' ? '+' : '-'}{formatCurrency(transaction.amount || 0)}
                  </span>
                </div>
              ))}
              {allTransactions.length === 0 && (
                <p className="text-center text-gray-500 py-8">אין תנועות בחודש זה</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
