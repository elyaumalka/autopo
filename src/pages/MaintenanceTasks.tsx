import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wrench, Check, Edit, Trash2, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type MaintenanceTask = Tables<"maintenance_tasks">;
type Vehicle = Tables<"vehicles">;

const maintenanceTypes = [
  "טיפול תקופתי",
  "החלפת שמן",
  "צמיגים",
  "בלמים",
  "טסט",
  "חידוש רישוי",
  "ביטוח",
  "אחר",
] as const;

const taskStatuses = ["ממתין", "בתהליך", "הושלם"] as const;

export default function MaintenanceTasks() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["maintenance_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MaintenanceTask[];
    },
  });

  const { data: vehicles = [] } = useQuery({
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

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && tasks.length > 0) {
      const task = tasks.find(t => t.id === editId);
      if (task) {
        setSelectedTask(task);
        setIsOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [tasks, searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<MaintenanceTask>) => {
      const { error } = await supabase.from("maintenance_tasks").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      setIsOpen(false);
      setSelectedTask(null);
      toast({ title: "המשימה נוצרה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה ביצירת משימה", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaintenanceTask> }) => {
      const { error } = await supabase.from("maintenance_tasks").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      setIsOpen(false);
      setSelectedTask(null);
      toast({ title: "המשימה עודכנה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון משימה", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      toast({ title: "המשימה נמחקה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה במחיקת משימה", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const vehicleId = formData.get("vehicle_id") as string;
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    const data: Partial<MaintenanceTask> = {
      vehicle_id: vehicleId,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
      type: formData.get("type") as any,
      status: formData.get("status") as any,
      due_date: (formData.get("due_date") as string) || null,
      due_km: formData.get("due_km") ? parseFloat(formData.get("due_km") as string) : null,
      cost: formData.get("cost") ? parseFloat(formData.get("cost") as string) : null,
      description: (formData.get("description") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const markComplete = (task: MaintenanceTask) => {
    updateMutation.mutate({
      id: task.id,
      data: {
        status: "הושלם",
        completed_date: format(new Date(), "yyyy-MM-dd"),
      },
    });
  };

  const filteredTasks =
    statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const pendingCount = tasks.filter((t) => t.status === "ממתין").length;

  const columns = [
    {
      header: "רכב",
      cell: (row: MaintenanceTask) => (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-muted-foreground" />
          <span>{row.vehicle_details || "-"}</span>
        </div>
      ),
    },
    {
      header: "סוג טיפול",
      cell: (row: MaintenanceTask) => (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
          {row.type}
        </span>
      ),
    },
    {
      header: "תאריך יעד",
      cell: (row: MaintenanceTask) =>
        row.due_date ? format(new Date(row.due_date), "dd/MM/yyyy") : "-",
    },
    {
      header: 'ק"מ יעד',
      cell: (row: MaintenanceTask) =>
        row.due_km ? row.due_km.toLocaleString() : "-",
    },
    {
      header: "סטטוס",
      cell: (row: MaintenanceTask) => <StatusBadge status={row.status || "ממתין"} />,
    },
    {
      header: "פעולות",
      cell: (row: MaintenanceTask) => (
        <div className="flex gap-2">
          {row.status !== "הושלם" && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-600 hover:bg-green-50"
              onClick={() => markComplete(row)}
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedTask(row);
              setIsOpen(true);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate(row.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="משימות תפעול"
        subtitle={`${pendingCount} משימות ממתינות`}
        icon={Wrench}
        action={() => {
          setSelectedTask(null);
          setIsOpen(true);
        }}
        actionLabel="משימה חדשה"
        actionIcon={Wrench}
      />

      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="ממתין">ממתין</SelectItem>
            <SelectItem value="בתהליך">בתהליך</SelectItem>
            <SelectItem value="הושלם">הושלם</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredTasks}
        isLoading={isLoading}
        emptyMessage="לא נמצאו משימות תפעול"
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>רכב *</Label>
              <Select name="vehicle_id" defaultValue={selectedTask?.vehicle_id} required>
                <SelectTrigger>
                  <SelectValue placeholder="בחר רכב" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.manufacturer} {v.model} - {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סוג הטיפול *</Label>
                <Select name="type" defaultValue={selectedTask?.type || "טיפול תקופתי"}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div>
                <Label>סטטוס</Label>
                <Select name="status" defaultValue={selectedTask?.status || "ממתין"}>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך יעד</Label>
                <Input name="due_date" type="date" defaultValue={selectedTask?.due_date || ""} />
              </div>
              <div>
                <Label>ק"מ יעד</Label>
                <Input
                  name="due_km"
                  type="number"
                  defaultValue={selectedTask?.due_km || ""}
                />
              </div>
            </div>
            <div>
              <Label>עלות</Label>
              <Input name="cost" type="number" defaultValue={selectedTask?.cost || ""} />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea name="description" defaultValue={selectedTask?.description || ""} />
            </div>
            <div>
              <Label>הערות</Label>
              <Textarea name="notes" defaultValue={selectedTask?.notes || ""} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {selectedTask ? "עדכון" : "יצירה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
