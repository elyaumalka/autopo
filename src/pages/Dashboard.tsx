import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Car,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Wrench,
  ArrowLeft,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths } from "date-fns";

export default function Dashboard() {
  // Fetch stats
  const { data: vehicleStats, isLoading: loadingVehicles } = useQuery({
    queryKey: ["vehicleStats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("status");
      if (error) throw error;
      const available = data.filter((v) => v.status === "זמין").length;
      const rented = data.filter((v) => v.status === "מושכר").length;
      const total = data.length;
      return { available, rented, total };
    },
  });

  const { data: customerCount, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customerCount"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: monthlyIncome, isLoading: loadingIncomes } = useQuery({
    queryKey: ["monthlyIncome"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("incomes")
        .select("amount")
        .gte("date", startOfMonth.toISOString().split("T")[0]);
      if (error) throw error;
      return data.reduce((sum, i) => sum + (i.amount || 0), 0);
    },
  });

  const { data: collectionTasks, isLoading: loadingCollections } = useQuery({
    queryKey: ["openCollectionTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("*")
        .eq("status", "פתוח");
      if (error) throw error;
      return data;
    },
  });

  const { data: maintenanceTasks, isLoading: loadingMaintenance } = useQuery({
    queryKey: ["pendingMaintenanceTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .eq("status", "ממתין")
        .limit(4);
      if (error) throw error;
      return data;
    },
  });

  const { data: activeRentals, isLoading: loadingRentals } = useQuery({
    queryKey: ["activeRentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("status", "פעיל")
        .order("planned_end_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyData } = useQuery({
    queryKey: ["monthlyChartData"],
    queryFn: async () => {
      const data = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const { data: incomes } = await supabase
          .from("incomes")
          .select("amount")
          .gte("date", startOfMonth.toISOString().split("T")[0])
          .lte("date", endOfMonth.toISOString().split("T")[0]);

        data.push({
          name: format(date, "MMM"),
          income: incomes?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0,
        });
      }
      return data;
    },
  });

  const isLoading = loadingVehicles || loadingCustomers || loadingIncomes;
  const totalDebt = collectionTasks?.reduce((sum, t) => sum + (t.amount - (t.paid_amount || 0)), 0) || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">שלום! 👋</h1>
        <p className="text-gray-500 mt-1">הנה סקירה של העסק שלך היום</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="רכבים זמינים"
          value={isLoading ? "..." : `${vehicleStats?.available || 0}/${vehicleStats?.total || 0}`}
          icon={Car}
          color="cyan"
          subtitle={`${vehicleStats?.rented || 0} מושכרים כרגע`}
        />
        <StatCard
          title="לקוחות"
          value={isLoading ? "..." : String(customerCount || 0)}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="הכנסות החודש"
          value={isLoading ? "..." : formatCurrency(monthlyIncome || 0)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="חובות לגבייה"
          value={isLoading ? "..." : formatCurrency(totalDebt)}
          icon={AlertTriangle}
          color="red"
          subtitle={`${collectionTasks?.length || 0} פריטים פתוחים`}
        />
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">הכנסות - 6 חודשים אחרונים</h2>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData || []}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: number) => [`₪${value.toLocaleString()}`, "הכנסה"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#0891b2"
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Rentals */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">השכרות פעילות</h2>
            <Link
              to="/rentals"
              className="text-cyan-600 hover:text-cyan-700 text-sm flex items-center gap-1"
            >
              הכל <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loadingRentals ? (
              [...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : !activeRentals || activeRentals.length === 0 ? (
              <p className="text-gray-500 text-center py-8">אין השכרות פעילות</p>
            ) : (
              activeRentals.map((rental) => (
                <div
                  key={rental.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{rental.customer_name}</p>
                    <p className="text-xs text-gray-500">{rental.vehicle_details}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-500">עד</p>
                    <p className="text-sm font-medium text-gray-900">
                      {rental.planned_end_date ? formatShortDate(rental.planned_end_date) : "-"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance Tasks */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">משימות תפעול</h2>
            </div>
            <Link
              to="/maintenance-tasks"
              className="text-cyan-600 hover:text-cyan-700 text-sm flex items-center gap-1"
            >
              הכל <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loadingMaintenance ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : !maintenanceTasks || maintenanceTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-6">אין משימות פתוחות</p>
            ) : (
              maintenanceTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{task.type}</p>
                    <p className="text-xs text-gray-500">{task.vehicle_details}</p>
                  </div>
                  <div className="text-left">
                    {task.due_date && (
                      <p className="text-sm text-orange-600 font-medium">
                        {formatShortDate(task.due_date)}
                      </p>
                    )}
                    {task.due_km && (
                      <p className="text-xs text-gray-500">{task.due_km} ק"מ</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Collection Tasks */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">גבייה</h2>
            </div>
            <Link
              to="/collection-tasks"
              className="text-cyan-600 hover:text-cyan-700 text-sm flex items-center gap-1"
            >
              הכל <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {loadingCollections ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : !collectionTasks || collectionTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-6">אין חובות פתוחים</p>
            ) : (
              collectionTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{task.customer_name}</p>
                    <p className="text-xs text-gray-500">{task.vehicle_details}</p>
                  </div>
                  <p className="text-red-600 font-bold">
                    ₪{(task.amount - (task.paid_amount || 0)).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}