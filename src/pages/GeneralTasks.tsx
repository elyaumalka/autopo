import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckSquare, Check, Edit, Trash2, Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables, Constants } from "@/integrations/supabase/types";

type GeneralTask = Tables<"general_tasks">;

const taskTypes = ["כללי", "טלפון", "פגישה", "מסמכים", "אחר"] as const;
const taskStatuses = ["ממתין", "בתהליך", "הושלם"] as const;
const priorities = ["נמוכה", "בינונית", "גבוהה", "דחוף"] as const;

export default function GeneralTasks() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GeneralTask | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  // Form state for controlled selects
  const [formType, setFormType] = useState<string>("כללי");
  const [formPriority, setFormPriority] = useState<string>("בינונית");
  const [formStatus, setFormStatus] = useState<string>("ממתין");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["generalTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GeneralTask[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<GeneralTask>) => {
      const { error } = await supabase.from("general_tasks").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalTasks"] });
      setIsOpen(false);
      setSelectedTask(null);
      toast({ title: "משימה נוצרה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה ביצירת משימה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GeneralTask> }) => {
      const { error } = await supabase.from("general_tasks").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalTasks"] });
      setIsOpen(false);
      setSelectedTask(null);
      toast({ title: "משימה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון משימה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("general_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generalTasks"] });
      toast({ title: "משימה נמחקה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקת משימה", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: Partial<GeneralTask> = {
      title: formData.get("title") as string,
      type: formType as any,
      priority: formPriority as any,
      status: formStatus as any,
      due_date: formData.get("due_date") as string,
      due_time: (formData.get("due_time") as string) || null,
      reminder_date: (formData.get("reminder_date") as string) || null,
      reminder_time: (formData.get("reminder_time") as string) || null,
      description: (formData.get("description") as string) || null,
    };

    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const markComplete = (task: GeneralTask) => {
    updateMutation.mutate({
      id: task.id,
      data: { status: "הושלם" as any },
    });
  };

  const openNewTask = () => {
    setSelectedTask(null);
    setFormType("כללי");
    setFormPriority("בינונית");
    setFormStatus("ממתין");
    setIsOpen(true);
  };

  const openEditTask = (task: GeneralTask) => {
    setSelectedTask(task);
    setFormType(task.type || "כללי");
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setIsOpen(true);
  };

  const filteredTasks = statusFilter === "all"
    ? tasks
    : tasks.filter((t) => t.status === statusFilter);

  const pendingTasks = tasks.filter((t) => t.status === "ממתין");
  const urgentTasks = tasks.filter((t) => t.priority === "דחוף" && t.status !== "הושלם");

  const priorityColors: Record<string, string> = {
    "נמוכה": "border-r-gray-400",
    "בינונית": "border-r-blue-400",
    "גבוהה": "border-r-orange-400",
    "דחוף": "border-r-red-500",
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="משימות כלליות"
        subtitle={`${pendingTasks.length} משימות ממתינות`}
        action={
          <Button onClick={openNewTask}>
            <CheckSquare className="ml-2 h-4 w-4" />
            משימה חדשה
          </Button>
        }
      />

      {/* Urgent Tasks Alert */}
      {urgentTasks.length > 0 && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{urgentTasks.length} משימות דחופות דורשות טיפול</span>
          </div>
        </Card>
      )}

      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            {taskStatuses.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">אין משימות</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={`p-4 border-r-4 ${priorityColors[task.priority] || priorityColors["בינונית"]} ${
                  task.status === "הושלם" ? "opacity-60" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3
                      className={`font-medium ${
                        task.status === "הושלם" ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    <span className="text-sm text-gray-500">{task.type}</span>
                  </div>
                  <StatusBadge status={task.priority || "בינונית"} />
                </div>

                {task.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  {task.due_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{format(new Date(task.due_date), "dd/MM/yyyy")}</span>
                      {task.due_time && <span>{task.due_time}</span>}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <StatusBadge status={task.status || "ממתין"} />
                  <div className="flex gap-1">
                    {task.status !== "הושלם" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => markComplete(task)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditTask(task)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>כותרת *</Label>
              <Input name="title" defaultValue={selectedTask?.title || ""} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סוג</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>עדיפות</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך ביצוע *</Label>
                <Input
                  name="due_date"
                  type="date"
                  defaultValue={selectedTask?.due_date || ""}
                  required
                />
              </div>
              <div>
                <Label>שעה</Label>
                <Input
                  name="due_time"
                  type="time"
                  defaultValue={selectedTask?.due_time || ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תזכורת</Label>
                <Input
                  name="reminder_date"
                  type="date"
                  defaultValue={selectedTask?.reminder_date || ""}
                />
              </div>
              <div>
                <Label>שעת תזכורת</Label>
                <Input
                  name="reminder_time"
                  type="time"
                  defaultValue={selectedTask?.reminder_time || ""}
                />
              </div>
            </div>
            <div>
              <Label>סטטוס</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {taskStatuses.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea name="description" defaultValue={selectedTask?.description || ""} />
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
