import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { DollarSign, Phone, MessageSquare, Edit, Check, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import { format } from "date-fns";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

type CollectionTask = Tables<"collection_tasks">;
type Customer = Tables<"customers">;

const collectionStatuses = Constants.public.Enums.collection_status;

interface CallHistoryItem {
  date: string;
  notes: string;
}

export default function CollectionTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CollectionTask | null>(null);
  const [callDialog, setCallDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [collectionCustomerId, setCollectionCustomerId] = useState("");
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["collectionTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CollectionTask[];
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    }
  });

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && tasks.length > 0) {
      const task = tasks.find(t => t.id === editId);
      if (task) {
        setSelectedTask(task);
        setCollectionCustomerId(task.customer_id || "");
        setIsOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [tasks, searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<"collection_tasks">) => {
      const { error } = await supabase.from("collection_tasks").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionTasks"] });
      toast({ title: "משימת גבייה נוצרה בהצלחה" });
      setIsOpen(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "שגיאה ביצירת משימה", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CollectionTask> }) => {
      const { error } = await supabase.from("collection_tasks").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collectionTasks"] });
      toast({ title: "משימה עודכנה בהצלחה" });
      setIsOpen(false);
      setCallDialog(false);
      setSelectedTask(null);
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון משימה", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    data.amount = parseFloat(data.amount as string);
    if (data.paid_amount) data.paid_amount = parseFloat(data.paid_amount as string);
    
    // Convert empty date strings to null
    const dateFields = ["debt_date", "payment_due_date", "reminder_date"];
    dateFields.forEach(field => {
      if (!data[field] || data[field] === "") data[field] = null;
    });

    data.customer_id = collectionCustomerId || null;
    const customer = customers.find(c => c.id === collectionCustomerId);
    if (customer) {
      data.customer_name = `${customer.first_name} ${customer.last_name}`;
    }

    if (selectedTask) {
      updateMutation.mutate({ id: selectedTask.id, data: data as Partial<CollectionTask> });
    } else {
      createMutation.mutate(data as TablesInsert<"collection_tasks">);
    }
  };

  const addCallNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask) return;

    const formData = new FormData(e.currentTarget);
    const notes = formData.get("notes") as string;

    const existingHistory = selectedTask.call_history as unknown;
    const callHistory: CallHistoryItem[] = Array.isArray(existingHistory) ? existingHistory : [];
    callHistory.push({
      date: format(new Date(), "yyyy-MM-dd HH:mm"),
      notes
    });

    updateMutation.mutate({
      id: selectedTask.id,
      data: { call_history: callHistory as unknown as Json }
    });
  };

  const markPaid = (task: CollectionTask) => {
    updateMutation.mutate({
      id: task.id,
      data: {
        status: "נסגר",
        paid_amount: task.amount
      }
    });
  };

  // Separate tasks by payment due date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgentTasks = tasks.filter(t => {
    if (t.status === "נסגר") return false;
    if (!t.payment_due_date) return true; // No due date = show as urgent
    const dueDate = new Date(t.payment_due_date);
    return dueDate <= today;
  });

  const futureTasks = tasks.filter(t => {
    if (t.status === "נסגר") return false;
    if (!t.payment_due_date) return false;
    const dueDate = new Date(t.payment_due_date);
    return dueDate > today;
  });

  const filteredTasks = statusFilter === "all"
    ? urgentTasks
    : urgentTasks.filter(t => t.status === statusFilter);

  const totalDebt = urgentTasks
    .reduce((sum, t) => sum + ((t.amount || 0) - (t.paid_amount || 0)), 0);

  const totalFutureIncome = futureTasks
    .reduce((sum, t) => sum + ((t.amount || 0) - (t.paid_amount || 0)), 0);

  const openCount = urgentTasks.filter(t => t.status === "פתוח").length;

  const columns = [
    {
      header: "לקוח",
      cell: (row: CollectionTask) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="font-medium">{row.customer_name}</p>
            <p className="text-sm text-muted-foreground">{row.vehicle_details}</p>
          </div>
        </div>
      )
    },
    {
      header: "תאריך חוב",
      cell: (row: CollectionTask) => row.debt_date ? format(new Date(row.debt_date), "dd/MM/yyyy") : "-"
    },
    {
      header: "יעד תשלום",
      cell: (row: CollectionTask) => {
        if (!row.payment_due_date) return "-";
        const dueDate = new Date(row.payment_due_date);
        const isOverdue = dueDate < today;
        return (
          <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
            {format(dueDate, "dd/MM/yyyy")}
          </span>
        );
      }
    },
    {
      header: "סכום",
      cell: (row: CollectionTask) => (
        <span className="font-bold text-red-600">₪{row.amount?.toLocaleString() || 0}</span>
      )
    },
    {
      header: "שולם",
      cell: (row: CollectionTask) => (
        <span className="text-green-600">₪{row.paid_amount?.toLocaleString() || 0}</span>
      )
    },
    {
      header: "יתרה",
      cell: (row: CollectionTask) => (
        <span className="font-bold text-orange-600">
          ₪{((row.amount || 0) - (row.paid_amount || 0)).toLocaleString()}
        </span>
      )
    },
    {
      header: "סטטוס",
      cell: (row: CollectionTask) => <StatusBadge status={row.status || "פתוח"} />
    },
    {
      header: "פעולות",
      cell: (row: CollectionTask) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSelectedTask(row); setCallDialog(true); }}
          >
            <Phone className="w-4 h-4" />
          </Button>
          {row.status !== "נסגר" && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => markPaid(row)}
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedTask(row); setCollectionCustomerId(row.customer_id || ""); setIsOpen(true); }}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="משימות גבייה"
        subtitle={`${openCount} פריטים פתוחים`}
        action={() => { setSelectedTask(null); setCollectionCustomerId(""); setIsOpen(true); }}
        actionLabel="משימה חדשה"
        actionIcon={DollarSign}
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-6 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">גבייה דחופה</p>
              <p className="text-3xl font-bold text-red-600">₪{totalDebt.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">תאריך תשלום עבר או לא הוגדר</p>
            </div>
            <DollarSign className="w-12 h-12 text-red-300" />
          </div>
        </Card>
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">הכנסות עתידיות</p>
              <p className="text-3xl font-bold text-blue-600">₪{totalFutureIncome.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">תשלומים שטרם הגיע מועדם</p>
            </div>
            <DollarSign className="w-12 h-12 text-blue-300" />
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            {collectionStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-3 text-red-600">התרעות גבייה - דורש טיפול מיידי</h3>
        <DataTable
          columns={columns}
          data={filteredTasks}
          isLoading={isLoading}
          emptyMessage="אין משימות גבייה דחופות"
        />
      </div>

      {futureTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-blue-600">הכנסות עתידיות</h3>
          <DataTable
            columns={columns}
            data={futureTasks}
            isLoading={isLoading}
            emptyMessage="אין הכנסות עתידיות"
          />
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTask ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>לקוח *</Label>
              <CustomerSearchSelect
                customers={customers}
                value={collectionCustomerId}
                onValueChange={setCollectionCustomerId}
                placeholder="בחר לקוח"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סכום חוב *</Label>
                <Input name="amount" type="number" defaultValue={selectedTask?.amount} required />
              </div>
              <div>
                <Label>סכום ששולם</Label>
                <Input name="paid_amount" type="number" defaultValue={selectedTask?.paid_amount || 0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>תאריך חוב</Label>
                <Input name="debt_date" type="date" defaultValue={selectedTask?.debt_date || ""} />
              </div>
              <div>
                <Label>תאריך יעד לתשלום</Label>
                <Input name="payment_due_date" type="date" defaultValue={selectedTask?.payment_due_date || ""} />
                <p className="text-xs text-muted-foreground mt-1">אם לא מוגדר - יופיע כגבייה דחופה</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סטטוס</Label>
                <Select name="status" defaultValue={selectedTask?.status || "פתוח"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {collectionStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>תזכורת</Label>
                <Input name="reminder_date" type="date" defaultValue={selectedTask?.reminder_date || ""} />
              </div>
            </div>
            <div>
              <Label>סיבת החוב</Label>
              <Textarea name="reason" defaultValue={selectedTask?.reason || ""} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                {selectedTask ? "עדכון" : "יצירה"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Call History Dialog */}
      <Dialog open={callDialog} onOpenChange={setCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>היסטוריית שיחות - {selectedTask?.customer_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing calls */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {(() => {
                const history = selectedTask?.call_history;
                const callHistoryArr: CallHistoryItem[] = Array.isArray(history) 
                  ? (history as unknown as CallHistoryItem[]) 
                  : [];
                return callHistoryArr.length > 0 ? (
                  callHistoryArr.map((call, i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">{call.date}</p>
                      <p>{call.notes}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">אין שיחות קודמות</p>
                );
              })()}
            </div>

            {/* Add new call */}
            <form onSubmit={addCallNote} className="border-t pt-4">
              <Label>הוסף הערה לשיחה</Label>
              <Textarea name="notes" className="mt-2" placeholder="פרטי השיחה..." />
              <div className="flex gap-3 mt-4">
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                  <MessageSquare className="w-4 h-4 ml-2" />
                  הוסף
                </Button>
                <Button type="button" variant="outline" onClick={() => setCallDialog(false)}>
                  סגור
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
