import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, Plus, Search, Pencil, Trash2, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";

type MaintenanceTask = Tables<"maintenance_tasks">;
type Vehicle = Tables<"vehicles">;

const maintenanceTypes = Constants.public.Enums.maintenance_type;
const taskStatuses = Constants.public.Enums.task_status;

export default function MaintenanceTasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    type: "" as typeof maintenanceTypes[number] | "",
    description: "",
    due_date: "",
    due_km: "",
    status: "ממתין" as typeof taskStatuses[number],
    cost: "",
    notes: "",
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["maintenance_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as MaintenanceTask[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("manufacturer");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (task: TablesInsert<"maintenance_tasks">) => {
      const { error } = await supabase.from("maintenance_tasks").insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      toast({ title: "משימת טיפול נוצרה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה ביצירת משימה", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...task }: Partial<MaintenanceTask> & { id: string }) => {
      const { error } = await supabase
        .from("maintenance_tasks")
        .update(task)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      toast({ title: "משימה עודכנה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון משימה", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      toast({ title: "משימה נמחקה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה במחיקת משימה", variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
    setFormData({
      vehicle_id: "",
      type: "",
      description: "",
      due_date: "",
      due_km: "",
      status: "ממתין",
      cost: "",
      notes: "",
    });
  };

  const handleEdit = (task: MaintenanceTask) => {
    setEditingTask(task);
    setFormData({
      vehicle_id: task.vehicle_id,
      type: task.type,
      description: task.description || "",
      due_date: task.due_date || "",
      due_km: task.due_km?.toString() || "",
      status: task.status,
      cost: task.cost?.toString() || "",
      notes: task.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.vehicle_id || !formData.type) {
      toast({ title: "נא למלא שדות חובה", variant: "destructive" });
      return;
    }

    const vehicle = vehicles?.find((v) => v.id === formData.vehicle_id);
    const taskData = {
      vehicle_id: formData.vehicle_id,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
      type: formData.type as typeof maintenanceTypes[number],
      description: formData.description || null,
      due_date: formData.due_date || null,
      due_km: formData.due_km ? parseFloat(formData.due_km) : null,
      status: formData.status,
      cost: formData.cost ? parseFloat(formData.cost) : null,
      notes: formData.notes || null,
    };

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, ...taskData });
    } else {
      createMutation.mutate(taskData);
    }
  };

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.vehicle_details?.includes(searchQuery) ||
      task.type.includes(searchQuery) ||
      task.description?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות טיפול"
        subtitle="ניהול משימות טיפול ותחזוקת רכבים"
        icon={Wrench}
        action={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            משימה חדשה
          </Button>
        }
      />

      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {taskStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-6">
          {!filteredTasks?.length ? (
            <EmptyState
              icon={<Wrench className="h-8 w-8 text-gray-300" />}
              title="אין משימות טיפול"
              description="לא נמצאו משימות טיפול במערכת"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>רכב</TableHead>
                    <TableHead>סוג טיפול</TableHead>
                    <TableHead>תאריך יעד</TableHead>
                    <TableHead>ק"מ יעד</TableHead>
                    <TableHead>עלות</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-orange-500" />
                          {task.vehicle_details || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                          {task.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.due_date
                          ? format(new Date(task.due_date), "dd/MM/yyyy", { locale: he })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {task.due_km ? task.due_km.toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        {task.cost ? `₪${task.cost.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "עריכת משימת טיפול" : "משימת טיפול חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>רכב *</Label>
              <Select
                value={formData.vehicle_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, vehicle_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר רכב" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles?.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.manufacturer} {vehicle.model} - {vehicle.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סוג טיפול *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as typeof maintenanceTypes[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  {maintenanceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>תאריך יעד</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>ק"מ יעד</Label>
              <Input
                type="number"
                value={formData.due_km}
                onChange={(e) =>
                  setFormData({ ...formData, due_km: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as typeof taskStatuses[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>עלות</Label>
              <Input
                type="number"
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>תיאור</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              ביטול
            </Button>
            <Button onClick={handleSubmit}>
              {editingTask ? "עדכון" : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
