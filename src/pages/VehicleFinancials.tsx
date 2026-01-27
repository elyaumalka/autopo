import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Car, TrendingUp, TrendingDown, DollarSign, Eye } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Vehicle = Tables<"vehicles">;
type Income = Tables<"incomes">;
type Expense = Tables<"expenses">;

interface VehicleFinancial extends Vehicle {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  roi: number;
  expenseBreakdown: Record<string, number>;
  displayName: string;
}

export default function VehicleFinancials() {
  const [viewingVehicle, setViewingVehicle] = useState<VehicleFinancial | null>(null);

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
    }
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("*");
      if (error) throw error;
      return data as Income[];
    }
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*");
      if (error) throw error;
      return data as Expense[];
    }
  });

  // Calculate financials per vehicle
  const vehicleFinancials: VehicleFinancial[] = vehicles.map(vehicle => {
    const vehicleIncomes = incomes.filter(i => i.vehicle_id === vehicle.id);
    const vehicleExpenses = expenses.filter(e => e.vehicle_id === vehicle.id);
    
    const totalIncome = vehicleIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalExpenses = vehicleExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    const roi = totalExpenses > 0 
      ? parseFloat(((netProfit / totalExpenses) * 100).toFixed(1))
      : 0;

    // Breakdown by expense type
    const expenseBreakdown: Record<string, number> = {};
    vehicleExpenses.forEach(e => {
      const type = e.type || 'אחר';
      expenseBreakdown[type] = (expenseBreakdown[type] || 0) + (e.amount || 0);
    });

    return {
      ...vehicle,
      totalIncome,
      totalExpenses,
      netProfit,
      roi,
      expenseBreakdown,
      displayName: `${vehicle.manufacturer} ${vehicle.model}`
    };
  });

  // Sort by profit
  const sortedVehicles = [...vehicleFinancials].sort((a, b) => b.netProfit - a.netProfit);

  // Chart data - top 10 vehicles
  const chartData = sortedVehicles.slice(0, 10).map(v => ({
    name: `${v.license_plate}`,
    הכנסות: v.totalIncome,
    הוצאות: v.totalExpenses,
    רווח: v.netProfit
  }));

  // Totals
  const totals = vehicleFinancials.reduce((acc, v) => ({
    income: acc.income + v.totalIncome,
    expenses: acc.expenses + v.totalExpenses
  }), { income: 0, expenses: 0 });

  const columns = [
    {
      header: "רכב",
      cell: (row: VehicleFinancial) => (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-gray-400" />
          <div>
            <p className="font-medium">{row.displayName}</p>
            <p className="text-sm text-gray-500">{row.license_plate}</p>
          </div>
        </div>
      )
    },
    {
      header: "ק\"מ נוכחי",
      cell: (row: VehicleFinancial) => (row.current_km || 0).toLocaleString()
    },
    {
      header: "הכנסות",
      cell: (row: VehicleFinancial) => (
        <span className="text-green-600 font-medium">₪{row.totalIncome.toLocaleString()}</span>
      )
    },
    {
      header: "הוצאות",
      cell: (row: VehicleFinancial) => (
        <span className="text-red-600 font-medium">₪{row.totalExpenses.toLocaleString()}</span>
      )
    },
    {
      header: "רווח נקי",
      cell: (row: VehicleFinancial) => (
        <span className={`font-bold ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          ₪{row.netProfit.toLocaleString()}
        </span>
      )
    },
    {
      header: "ROI",
      cell: (row: VehicleFinancial) => (
        <span className={row.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
          {row.roi}%
        </span>
      )
    },
    {
      header: "פעולות",
      cell: (row: VehicleFinancial) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewingVehicle(row)}
        >
          <Eye className="w-4 h-4" />
        </Button>
      )
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="דוח רכבים פיננסי"
        subtitle="הכנסות, הוצאות ורווחיות לפי רכב"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 border-r-4 border-r-blue-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">סה"כ רכבים</p>
              <p className="text-xl font-bold">{vehicles.length}</p>
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
              <p className="text-xl font-bold text-green-600">₪{totals.income.toLocaleString()}</p>
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
              <p className="text-xl font-bold text-red-600">₪{totals.expenses.toLocaleString()}</p>
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
              <p className={`text-xl font-bold ${totals.income - totals.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₪{(totals.income - totals.expenses).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold mb-4">השוואת רכבים (10 המובילים)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                formatter={(value: number) => `₪${value.toLocaleString()}`}
                contentStyle={{ borderRadius: 12 }}
              />
              <Legend />
              <Bar dataKey="הכנסות" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="הוצאות" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={sortedVehicles}
        isLoading={loadingVehicles}
        emptyMessage="לא נמצאו רכבים"
      />

      {/* Vehicle Details Dialog */}
      {viewingVehicle && (
        <Dialog open={!!viewingVehicle} onOpenChange={() => setViewingVehicle(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                פירוט פיננסי - {viewingVehicle.displayName} ({viewingVehicle.license_plate})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-green-50">
                  <p className="text-sm text-gray-600 mb-1">סה״כ הכנסות</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₪{viewingVehicle.totalIncome.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-4 bg-red-50">
                  <p className="text-sm text-gray-600 mb-1">סה״כ הוצאות</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₪{viewingVehicle.totalExpenses.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-4 bg-cyan-50">
                  <p className="text-sm text-gray-600 mb-1">רווח נקי</p>
                  <p className={`text-2xl font-bold ${viewingVehicle.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₪{viewingVehicle.netProfit.toLocaleString()}
                  </p>
                </Card>
                <Card className="p-4 bg-blue-50">
                  <p className="text-sm text-gray-600 mb-1">ROI</p>
                  <p className={`text-2xl font-bold ${viewingVehicle.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {viewingVehicle.roi}%
                  </p>
                </Card>
              </div>

              {/* Expense Breakdown */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">פירוט הוצאות</h3>
                <div className="space-y-2">
                  {Object.entries(viewingVehicle.expenseBreakdown).map(([type, amount]) => (
                    <div key={type} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm">{type}</span>
                      <span className="font-medium text-red-600">₪{amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {Object.keys(viewingVehicle.expenseBreakdown).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">אין הוצאות רשומות</p>
                  )}
                </div>
              </Card>

              {/* Income Details */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">פירוט הכנסות</h3>
                <div className="space-y-2">
                  {incomes
                    .filter(i => i.vehicle_id === viewingVehicle.id)
                    .map((income, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{income.type}</p>
                          <p className="text-xs text-gray-500">{income.date} • {income.customer_name || '-'}</p>
                        </div>
                        <span className="font-medium text-green-600">₪{income.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  {incomes.filter(i => i.vehicle_id === viewingVehicle.id).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">אין הכנסות רשומות</p>
                  )}
                </div>
              </Card>

              {/* Expense Details */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">פירוט הוצאות מפורט</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {expenses
                    .filter(e => e.vehicle_id === viewingVehicle.id)
                    .map((expense, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{expense.type}</p>
                          <p className="text-xs text-gray-500">
                            {expense.date} • {expense.description || '-'}
                          </p>
                        </div>
                        <span className="font-medium text-red-600">₪{expense.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  {expenses.filter(e => e.vehicle_id === viewingVehicle.id).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">אין הוצאות רשומות</p>
                  )}
                </div>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
