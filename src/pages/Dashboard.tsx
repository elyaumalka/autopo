import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/shared/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Car,
  Users,
  DollarSign,
  TrendingUp,
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
import type { Tables } from "@/integrations/supabase/types";

type Vehicle = Tables<"vehicles">;
type MaintenanceTask = Tables<"maintenance_tasks">;

export default function Dashboard() {
  // Fetch all vehicles
  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
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

  const { data: incomes = [] } = useQuery({
    queryKey: ["incomes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incomes").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: collectionTasks = [], isLoading: loadingCollections } = useQuery({
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

  const { data: maintenanceTasks = [], isLoading: loadingMaintenance } = useQuery({
    queryKey: ["pendingMaintenanceTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .eq("status", "ממתין")
        .limit(4);
      if (error) throw error;
      return data as MaintenanceTask[];
    },
  });

  const { data: activeRentals = [], isLoading: loadingRentals } = useQuery({
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

  // Calculate stats
  const availableVehicles = vehicles.filter(v => v.status === "זמין");
  const rentedVehicles = vehicles.filter(v => v.status === "מושכר");

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyIncome = incomes
    .filter(i => {
      const d = new Date(i.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  // Calculate monthly data for chart
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const month = d.getMonth();
    const year = d.getFullYear();
    const monthIncomes = incomes.filter(inc => {
      const incDate = new Date(inc.date);
      return incDate.getMonth() === month && incDate.getFullYear() === year;
    });
    monthlyData.push({
      name: format(d, "MMM"),
      income: monthIncomes.reduce((sum, inc) => sum + (inc.amount || 0), 0)
    });
  }

  const isLoading = loadingVehicles || loadingCustomers;
  const totalDebt = collectionTasks.reduce((sum, t) => sum + (t.amount - (t.paid_amount || 0)), 0);

  // Check for maintenance tasks that are overdue
  const today = new Date();
  const overdueMaintenanceTasks = maintenanceTasks.filter(task => {
    if (task.due_date && new Date(task.due_date) < today) return true;
    return false;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">שלום! 👋</h1>
        <p className="text-gray-500 mt-1">הנה סקירה של העסק שלך היום</p>
      </div>

      {/* Maintenance Alerts */}
      {overdueMaintenanceTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-200 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">התרעות תחזוקה</h3>
              <p className="text-sm text-red-700">
                {overdueMaintenanceTasks.length} משימות דורשות תשומת לב
              </p>
            </div>
            <Link 
              to="/maintenance-tasks"
              className="text-red-700 hover:text-red-900 text-sm font-medium"
            >
              צפה
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {overdueMaintenanceTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="text-sm bg-white rounded-lg p-2 border border-red-200">
                <span className="font-medium">{task.vehicle_details}</span>
                <span className="text-red-600 mr-2">• {task.type}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="רכבים זמינים"
          value={isLoading ? "..." : `${availableVehicles.length}/${vehicles.length}`}
          icon={Car}
          color="cyan"
          subtitle={`${rentedVehicles.length} מושכרים כרגע`}
        />
        <StatCard
          title="לקוחות"
          value={isLoading ? "..." : String(customerCount || 0)}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="הכנסות החודש"
          value={isLoading ? "..." : `₪${monthlyIncome.toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="חובות לגבייה"
          value={isLoading ? "..." : `₪${totalDebt.toLocaleString()}`}
          icon={AlertTriangle}
          color="red"
          subtitle={`${collectionTasks.length} פריטים פתוחים`}
        />
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white rounded-2xl border p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">הכנסות - 6 חודשים אחרונים</h2>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
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
        </motion.div>

        {/* Active Rentals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border p-6 shadow-sm"
        >
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
            ) : activeRentals.length === 0 ? (
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
                      {rental.planned_end_date ? format(new Date(rental.planned_end_date), "dd/MM") : "-"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border p-6 shadow-sm"
        >
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
            ) : maintenanceTasks.length === 0 ? (
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
                        {format(new Date(task.due_date), "dd/MM")}
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
        </motion.div>

        {/* Collection Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border p-6 shadow-sm"
        >
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
            ) : collectionTasks.length === 0 ? (
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
        </motion.div>
      </div>
    </div>
  );
}
