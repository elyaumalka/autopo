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
import { Tables } from "@/integrations/supabase/types";

type Income = Tables<"incomes">;
type Expense = Tables<"expenses">;
type Rental = Tables<"rentals">;

interface MissingPayment {
  customer_name: string;
  vehicle_details: string;
  expected: number;
  paid: number;
  missing: number;
  timing: string;
}

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
      return data as Income[];
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
      return data as Expense[];
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
  const netTotal = totalIncome - totalExpenses; // רווח נקי בפועל (לפני הכנסות צפויות)

  // Calculate expected income for the month
  const calculateExpectedIncome = () => {
    let expected = 0;
    const missingPayments: MissingPayment[] = [];

    rentals.forEach(rental => {
      if (rental.status === "בוטל") return;

      const rentalStart = new Date(rental.start_date);
      const rentalEnd = new Date(rental.actual_end_date || rental.planned_end_date || rental.start_date);

      // Check if rental overlaps with selected month
      if (rentalEnd < monthStart || rentalStart > monthEnd) return;

      const overlapStart = rentalStart > monthStart ? rentalStart : monthStart;
      const overlapEnd = rentalEnd < monthEnd ? rentalEnd : monthEnd;

      // Calculate days in rental and in month
      const daysInRental = Math.ceil((rentalEnd.getTime() - rentalStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      const daysInMonth = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Proportional cost for this month
      const proportionalCost = (rental.total_cost || rental.base_cost || 0) * (daysInMonth / daysInRental);
      expected += proportionalCost;

      // Check for missing payments - only for active rentals with outstanding balance
      if ((rental.paid_amount || 0) < proportionalCost) {
        missingPayments.push({
          customer_name: rental.customer_name || "לקוח",
          vehicle_details: rental.vehicle_details || "",
          expected: proportionalCost,
          paid: rental.paid_amount || 0,
          missing: proportionalCost - (rental.paid_amount || 0),
          timing: "מראש"
        });
      }
    });

    return { expected, missingPayments };
  };

  const { expected: expectedIncome, missingPayments } = calculateExpectedIncome();

  // רווח נקי כולל ההכנסות הצפויות (סעיף 25)
  const netWithExpected = expectedIncome - totalExpenses;

  // פילוח אשראי חוצה-חודשים (סעיף 26): מתוך האשראי שנגבה החודש - כמה שייך לחודש זה וכמה לחודשים אחרים
  // ההשתייכות נקבעת לפי תקופת ההשכרה המקושרת לתשלום
  const creditIncomes = incomes.filter(i => i.payment_method === "אשראי");
  let creditCurrentMonth = 0;
  let creditOtherMonths = 0;
  creditIncomes.forEach(i => {
    const rentalId = (i as any).rental_id;
    const rental = rentalId ? rentals.find(r => r.id === rentalId) : null;
    if (rental) {
      const rStart = new Date(rental.start_date);
      const rEnd = new Date(rental.actual_end_date || rental.planned_end_date || rental.start_date);
      const overlapsMonth = !(rEnd < monthStart || rStart > monthEnd);
      if (overlapsMonth) creditCurrentMonth += (i.amount || 0);
      else creditOtherMonths += (i.amount || 0);
    } else {
      // ללא השכרה מקושרת - משויך לחודש שבו נגבה
      creditCurrentMonth += (i.amount || 0);
    }
  });

  // All transactions sorted by date
  const allTransactions = [
    ...incomes.map(i => ({ ...i, transactionType: 'income' as const })),
    ...expenses.map(e => ({ ...e, transactionType: 'expense' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="תזרים"
        subtitle="מעקב אחר כסף בקופה ומזומנים בפועל"
      />

      {/* Month Selector */}
      <div className="mb-6">
        <Label>בחר חודש</Label>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard
              title="הכנסות צפויות"
              value={formatCurrency(expectedIncome)}
              icon={TrendingUp}
              color="blue"
              subtitle="לפי השכרות החודש"
            />
            <StatCard
              title="הכנסות בפועל"
              value={formatCurrency(totalIncome)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="הכנסות באשראי"
              value={formatCurrency(creditIn)}
              icon={CreditCard}
              color="blue"
            />
            <StatCard
              title="הוצאות"
              value={formatCurrency(totalExpenses)}
              icon={TrendingDown}
              color="red"
            />
            <StatCard
              title="מזומן בקופה"
              value={formatCurrency(netCash)}
              icon={Wallet}
              color={netCash >= 0 ? "cyan" : "orange"}
            />
            <StatCard
              title="רווח נקי"
              value={formatCurrency(netTotal)}
              icon={DollarSign}
              color={netTotal >= 0 ? "green" : "red"}
              subtitle={`כולל צפוי: ${formatCurrency(netWithExpected)}`}
            />
          </div>

          {/* Missing Payments Alert */}
          {missingPayments.length > 0 && (
            <Card className="p-6 mb-6 bg-red-50 border-2 border-red-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Receipt className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-900 mb-2">התרעת תשלומים חסרים</h3>
                  <p className="text-sm text-red-700 mb-3">
                    {missingPayments.length} לקוחות עם תשלומים חסרים בחודש זה
                  </p>
                  <div className="space-y-2">
                    {missingPayments.map((payment, i) => (
                      <div key={i} className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{payment.customer_name}</p>
                            <p className="text-sm text-gray-600">{payment.vehicle_details}</p>
                            <p className="text-xs text-red-600 mt-1">מועד תשלום: {payment.timing}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-sm text-gray-600">צפוי: {formatCurrency(payment.expected)}</p>
                            <p className="text-sm text-gray-600">שולם: {formatCurrency(payment.paid)}</p>
                            <p className="font-bold text-red-600">חסר: {formatCurrency(payment.missing)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Cash */}
            <Card className="p-6 border-r-4 border-r-green-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Banknote className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">מזומן</h3>
                  <p className="text-sm text-muted-foreground">תנועות במזומן</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(cashIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">יצא:</span>
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
            <Card className="p-6 border-r-4 border-r-blue-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">אשראי</h3>
                  <p className="text-sm text-muted-foreground">תנועות באשראי</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(creditIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">יצא:</span>
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
            <Card className="p-6 border-r-4 border-r-purple-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Receipt className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">אחר</h3>
                  <p className="text-sm text-muted-foreground">צ'ק / העברה</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">נכנס:</span>
                  <span className="font-bold text-green-600">{formatCurrency(otherIn)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">יצא:</span>
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

          {/* Credit cross-month breakdown (סעיף 26) */}
          <Card className="p-6 mb-6 border-r-4 border-r-blue-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">אשראי - פילוח לפי חודש</h3>
                <p className="text-sm text-muted-foreground">מתוך האשראי שנגבה החודש, כמה שייך לחודש זה וכמה לחודשים אחרים</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">סה״כ אשראי שנגבה החודש</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(creditIn)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">שייך לחודש הנוכחי</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(creditCurrentMonth)}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">שייך לחודשים אחרים</p>
                <p className="text-2xl font-bold text-orange-700">{formatCurrency(creditOtherMonths)}</p>
              </div>
            </div>
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4 text-lg">תנועות אחרונות</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allTransactions.map((transaction, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${transaction.transactionType === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {transaction.transactionType === 'income' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {transaction.transactionType === 'income' ? 'הכנסה' : 'הוצאה'} - {transaction.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.transactionType === 'income'
                          ? ((transaction as Income).customer_name || '-')
                          : ((transaction as Expense).vehicle_details || (transaction as Expense).description || '-')}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                <p className="text-center text-muted-foreground py-8">אין תנועות בחודש זה</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
