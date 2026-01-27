import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Car, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function VehicleFinancials() {
  const { data: vehicleFinancials, isLoading } = useQuery({
    queryKey: ["vehicleFinancials"],
    queryFn: async () => {
      // Get all vehicles
      const { data: vehicles, error: vError } = await supabase.from("vehicles").select("*");
      if (vError) throw vError;

      // Get incomes by vehicle
      const { data: incomes, error: iError } = await supabase.from("incomes").select("vehicle_id, amount");
      if (iError) throw iError;

      // Get expenses by vehicle
      const { data: expenses, error: eError } = await supabase.from("expenses").select("vehicle_id, amount");
      if (eError) throw eError;

      // Calculate financials per vehicle
      return vehicles.map((vehicle) => {
        const vehicleIncomes = incomes.filter((i) => i.vehicle_id === vehicle.id);
        const vehicleExpenses = expenses.filter((e) => e.vehicle_id === vehicle.id);

        const totalIncome = vehicleIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
        const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const profit = totalIncome - totalExpenses;
        const roi = totalExpenses > 0 ? ((profit / totalExpenses) * 100) : 0;

        return {
          id: vehicle.id,
          name: `${vehicle.manufacturer} ${vehicle.model}`,
          licensePlate: vehicle.license_plate,
          status: vehicle.status,
          currentKm: vehicle.current_km || 0,
          income: totalIncome,
          expenses: totalExpenses,
          profit,
          roi,
        };
      });
    },
  });

  const sortedByProfit = [...(vehicleFinancials || [])].sort((a, b) => b.profit - a.profit);
  const topPerformers = sortedByProfit.slice(0, 5);

  const totals = vehicleFinancials?.reduce(
    (acc, v) => ({
      income: acc.income + v.income,
      expenses: acc.expenses + v.expenses,
      profit: acc.profit + v.profit,
    }),
    { income: 0, expenses: 0, profit: 0 }
  ) || { income: 0, expenses: 0, profit: 0 };

  return (
    <div className="animate-fade-in">
      <PageHeader title="רווחיות רכבים" subtitle="ניתוח פיננסי לפי רכב" />

      {isLoading ? (
        <LoadingSpinner />
      ) : vehicleFinancials && vehicleFinancials.length > 0 ? (
        <>
          {/* Summary Cards - Base44 Style */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 border-r-4 border-r-blue-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Car className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">סה"כ רכבים</p>
                  <p className="text-xl font-bold">{vehicleFinancials.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-r-4 border-r-green-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">סה"כ הכנסות</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-r-4 border-r-red-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">סה"כ הוצאות</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(totals.expenses)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 border-r-4 border-r-cyan-500">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">רווח נקי</p>
                  <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card className="mb-6 p-6 bg-white">
            <h3 className="font-semibold text-lg text-gray-900 mb-4">רווחיות לפי רכב - 5 המובילים</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPerformers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="income" name="הכנסות" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="expenses" name="הוצאות" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" name="רווח" fill="#0891b2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Table */}
          <Card className="p-6 bg-white">
            <h3 className="font-semibold text-lg text-gray-900 mb-4">פירוט מלא</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>רכב</TableHead>
                  <TableHead>מספר רישוי</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>ק"מ נוכחי</TableHead>
                  <TableHead>הכנסות</TableHead>
                  <TableHead>הוצאות</TableHead>
                  <TableHead>רווח</TableHead>
                  <TableHead>ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedByProfit.map((vehicle) => (
                  <TableRow key={vehicle.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell className="font-mono text-sm">{vehicle.licensePlate}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          vehicle.status === "זמין"
                            ? "bg-green-100 text-green-800"
                            : vehicle.status === "מושכר"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {vehicle.status}
                      </span>
                    </TableCell>
                    <TableCell>{formatNumber(vehicle.currentKm)}</TableCell>
                    <TableCell className="text-green-600 font-medium">{formatCurrency(vehicle.income)}</TableCell>
                    <TableCell className="text-red-600 font-medium">{formatCurrency(vehicle.expenses)}</TableCell>
                    <TableCell className={vehicle.profit >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {formatCurrency(vehicle.profit)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(Math.abs(vehicle.roi), 100)}
                          className={`h-2 w-16 ${vehicle.roi >= 0 ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                        />
                        <span className={`text-sm font-medium ${vehicle.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {vehicle.roi.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        <EmptyState title="אין נתונים" description="לא נמצאו נתונים פיננסיים לרכבים" />
      )}
    </div>
  );
}