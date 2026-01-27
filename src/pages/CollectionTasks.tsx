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
import { Banknote, Plus, Search, Pencil, Trash2, Phone, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";

type CollectionTask = Tables<"collection_tasks">;
type Customer = Tables<"customers">;

const collectionStatuses = Constants.public.Enums.collection_status;

export default function CollectionTasks() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CollectionTask | null>(null);

  const [formData, setFormData] = useState({
    customer_id: "",
    amount: "",
    paid_amount: "",
    reason: "",
    debt_date: "",
    payment_due_date: "",
    reminder_date: "",
    status: "פתוח" as typeof collectionStatuses[number],
    notes: "",
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["collection_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("*")
        .order("payment_due_date", { ascending: true });
      if (error) throw error;
      return data as CollectionTask[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("status", "פעיל")
        .order("first_name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (task: TablesInsert<"collection_tasks">) => {
      const { error } = await supabase.from("collection_tasks").insert(task);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });
      toast({ title: "משימת גבייה נוצרה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה ביצירת משימה", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...task }: Partial<CollectionTask> & { id: string }) => {
      const { error } = await supabase
        .from("collection_tasks")
        .update(task)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });
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
        .from("collection_tasks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });
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
      customer_id: "",
      amount: "",
      paid_amount: "",
      reason: "",
      debt_date: "",
      payment_due_date: "",
      reminder_date: "",
      status: "פתוח",
      notes: "",
    });
  };

  const handleEdit = (task: CollectionTask) => {
    setEditingTask(task);
    setFormData({
      customer_id: task.customer_id || "",
      amount: task.amount.toString(),
      paid_amount: task.paid_amount?.toString() || "0",
      reason: task.reason || "",
      debt_date: task.debt_date || "",
      payment_due_date: task.payment_due_date || "",
      reminder_date: task.reminder_date || "",
      status: task.status,
      notes: task.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.customer_id || !formData.amount) {
      toast({ title: "נא למלא שדות חובה", variant: "destructive" });
      return;
    }

    const customer = customers?.find((c) => c.id === formData.customer_id);
    const taskData = {
      customer_id: formData.customer_id,
      customer_name: customer
        ? `${customer.first_name} ${customer.last_name}`
        : null,
      amount: parseFloat(formData.amount),
      paid_amount: parseFloat(formData.paid_amount) || 0,
      reason: formData.reason || null,
      debt_date: formData.debt_date || null,
      payment_due_date: formData.payment_due_date || null,
      reminder_date: formData.reminder_date || null,
      status: formData.status,
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
      task.customer_name?.includes(searchQuery) ||
      task.reason?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getRemainingAmount = (task: CollectionTask) => {
    return task.amount - (task.paid_amount || 0);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="משימות גבייה"
        subtitle="ניהול חובות וגביית תשלומים מלקוחות"
        icon={Banknote}
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
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {collectionStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!filteredTasks?.length ? (
            <EmptyState
              icon={<Banknote className="h-8 w-8 text-muted-foreground" />}
              title="אין משימות גבייה"
              description="לא נמצאו משימות גבייה במערכת"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>לקוח</TableHead>
                    <TableHead>סכום חוב</TableHead>
                    <TableHead>שולם</TableHead>
                    <TableHead>נותר</TableHead>
                    <TableHead>תאריך פירעון</TableHead>
                    <TableHead>סיבה</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {task.customer_name || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-destructive font-semibold">
                        ₪{task.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-green-600">
                        ₪{(task.paid_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        ₪{getRemainingAmount(task).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {task.payment_due_date
                          ? format(new Date(task.payment_due_date), "dd/MM/yyyy", {
                              locale: he,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>{task.reason || "-"}</TableCell>
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
              {editingTask ? "עריכת משימת גבייה" : "משימת גבייה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>לקוח *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, customer_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name} - {customer.phone}
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
                  setFormData({
                    ...formData,
                    status: value as typeof collectionStatuses[number],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {collectionStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סכום חוב *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>סכום ששולם</Label>
              <Input
                type="number"
                value={formData.paid_amount}
                onChange={(e) =>
                  setFormData({ ...formData, paid_amount: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>תאריך החוב</Label>
              <Input
                type="date"
                value={formData.debt_date}
                onChange={(e) =>
                  setFormData({ ...formData, debt_date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>תאריך פירעון</Label>
              <Input
                type="date"
                value={formData.payment_due_date}
                onChange={(e) =>
                  setFormData({ ...formData, payment_due_date: e.target.value })
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
              <Label>סיבה</Label>
              <Input
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
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
