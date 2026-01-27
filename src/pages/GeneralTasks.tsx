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
import { ClipboardList, Plus, Search, Pencil, Trash2, Calendar, Flag } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";

type GeneralTask = Tables<"general_tasks">;

const taskTypes = Constants.public.Enums.general_task_type;
const taskStatuses = Constants.public.Enums.task_status;
const priorities = Constants.public.Enums.priority;

export default function GeneralTasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GeneralTask | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "כללי" as typeof taskTypes[number],
    priority: "בינונית" as typeof priorities[number],
    status: "ממתין" as typeof taskStatuses[number],
    due_date: "",
    due_time: "",
    reminder_date: "",
    reminder_time: "",
    notes: "",
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["general_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as GeneralTask[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (task: TablesInsert<"general_tasks">) => {
      const { error } = await supabase.from("general_tasks").insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general_tasks"] });
      toast({ title: "משימה נוצרה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה ביצירת משימה", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...task }: Partial<GeneralTask> & { id: string }) => {
      const { error } = await supabase
        .from("general_tasks")
        .update(task)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general_tasks"] });
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
        .from("general_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general_tasks"] });
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
      title: "",
      description: "",
      type: "כללי",
      priority: "בינונית",
      status: "ממתין",
      due_date: "",
      due_time: "",
      reminder_date: "",
      reminder_time: "",
      notes: "",
    });
  };

  const handleEdit = (task: GeneralTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      type: task.type || "כללי",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      due_time: task.due_time || "",
      reminder_date: task.reminder_date || "",
      reminder_time: task.reminder_time || "",
      notes: task.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.due_date) {
      toast({ title: "נא למלא שדות חובה", variant: "destructive" });
      return;
    }

    const taskData = {
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      priority: formData.priority,
      status: formData.status,
      due_date: formData.due_date,
      due_time: formData.due_time || null,
      reminder_date: formData.reminder_date || null,
      reminder_time: formData.reminder_time || null,
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
      task.title.includes(searchQuery) ||
      task.description?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "דחוף":
        return "text-red-600";
      case "גבוהה":
        return "text-orange-600";
      case "בינונית":
        return "text-yellow-600";
      case "נמוכה":
        return "text-gray-600";
      default:
        return "";
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות כלליות"
        subtitle="ניהול משימות ופעילויות כלליות"
        icon={ClipboardList}
        action={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            משימה חדשה
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
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
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="עדיפות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל העדיפויות</SelectItem>
                {priorities.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!filteredTasks?.length ? (
            <EmptyState
              icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
              title="אין משימות"
              description="לא נמצאו משימות כלליות במערכת"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>כותרת</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>עדיפות</TableHead>
                    <TableHead>תאריך יעד</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.type}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                          <Flag className="h-4 w-4" />
                          {task.priority}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(task.due_date), "dd/MM/yyyy", {
                            locale: he,
                          })}
                          {task.due_time && ` ${task.due_time}`}
                        </div>
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
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "עריכת משימה" : "משימה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>כותרת *</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>סוג משימה</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as typeof taskTypes[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>עדיפות</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value as typeof priorities[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>תאריך יעד *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>שעת יעד</Label>
              <Input
                type="time"
                value={formData.due_time}
                onChange={(e) =>
                  setFormData({ ...formData, due_time: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>תאריך תזכורת</Label>
              <Input
                type="date"
                value={formData.reminder_date}
                onChange={(e) =>
                  setFormData({ ...formData, reminder_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>שעת תזכורת</Label>
              <Input
                type="time"
                value={formData.reminder_time}
                onChange={(e) =>
                  setFormData({ ...formData, reminder_time: e.target.value })
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
