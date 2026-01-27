import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Car,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

export default function Dashboard() {
  // Fetch stats
  const { data: vehicleStats } = useQuery({
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

  const { data: customerCount } = useQuery({
    queryKey: ["customerCount"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: monthlyIncome } = useQuery({
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

  const { data: monthlyExpenses } = useQuery({
    queryKey: ["monthlyExpenses"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .gte("date", startOfMonth.toISOString().split("T")[0]);
      if (error) throw error;
      return data.reduce((sum, e) => sum + (e.amount || 0), 0);
    },
  });

  const { data: urgentTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["urgentTasks"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .neq("status", "הושלם")
        .lte("due_date", today)
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: activeRentals, isLoading: rentalsLoading } = useQuery({
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

  const profit = (monthlyIncome || 0) - (monthlyExpenses || 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="לוח בקרה" subtitle="סקירה כללית של מערכת השכרת הרכב" />

      {/* Stats Grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="הכנסות החודש"
          value={monthlyIncome || 0}
          icon={DollarSign}
          color="success"
          isCurrency
        />
        <StatCard
          title="הוצאות החודש"
          value={monthlyExpenses || 0}
          icon={TrendingUp}
          color="destructive"
          isCurrency
        />
        <StatCard
          title="רווח נקי"
          value={profit}
          icon={TrendingUp}
          color={profit >= 0 ? "success" : "destructive"}
          isCurrency
        />
        <StatCard
          title="רכבים זמינים"
          value={vehicleStats?.available || 0}
          icon={Car}
          color="info"
          subtitle={`מתוך ${vehicleStats?.total || 0} רכבים`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Rentals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              השכרות פעילות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rentalsLoading ? (
              <LoadingSpinner />
            ) : activeRentals && activeRentals.length > 0 ? (
              <div className="space-y-4">
                {activeRentals.map((rental) => (
                  <div
                    key={rental.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{rental.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {rental.vehicle_details}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">
                        החזרה: {formatShortDate(rental.planned_end_date || "")}
                      </p>
                      {rental.remaining_payment && rental.remaining_payment > 0 && (
                        <p className="text-sm font-medium text-destructive">
                          נותר: {formatCurrency(rental.remaining_payment)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="אין השכרות פעילות"
                description="כרגע אין השכרות פעילות במערכת"
              />
            )}
          </CardContent>
        </Card>

        {/* Urgent Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              משימות דחופות
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <LoadingSpinner />
            ) : urgentTasks && urgentTasks.length > 0 ? (
              <div className="space-y-4">
                {urgentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{task.type}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {task.vehicle_details}
                      </p>
                    </div>
                    <div className="text-left">
                      <StatusBadge status={task.status} />
                      {task.due_date && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatShortDate(task.due_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Wrench className="h-8 w-8 text-muted-foreground" />}
                title="אין משימות דחופות"
                description="כל המשימות מעודכנות"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
