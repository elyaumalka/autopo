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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Receipt, Plus, Search, Pencil, Trash2, Car, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";

type TrafficTicket = Tables<"traffic_tickets">;
type Vehicle = Tables<"vehicles">;
type Customer = Tables<"customers">;

const ticketStatuses = Constants.public.Enums.ticket_status;

export default function TrafficTickets() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TrafficTicket | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    customer_id: "",
    ticket_number: "",
    date: "",
    amount: "",
    location: "",
    status: "חדש" as typeof ticketStatuses[number],
    driver_declaration: false,
    company_declaration: false,
    paid_date: "",
    notes: "",
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["traffic_tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_tickets")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as TrafficTicket[];
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

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("first_name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (ticket: TablesInsert<"traffic_tickets">) => {
      const { error } = await supabase.from("traffic_tickets").insert(ticket);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traffic_tickets"] });
      toast({ title: "דוח תנועה נוסף בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה בהוספת דוח", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...ticket }: Partial<TrafficTicket> & { id: string }) => {
      const { error } = await supabase
        .from("traffic_tickets")
        .update(ticket)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traffic_tickets"] });
      toast({ title: "דוח עודכן בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון דוח", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("traffic_tickets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traffic_tickets"] });
      toast({ title: "דוח נמחק בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה במחיקת דוח", variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTicket(null);
    setFormData({
      vehicle_id: "",
      customer_id: "",
      ticket_number: "",
      date: "",
      amount: "",
      location: "",
      status: "חדש",
      driver_declaration: false,
      company_declaration: false,
      paid_date: "",
      notes: "",
    });
  };

  const handleEdit = (ticket: TrafficTicket) => {
    setEditingTicket(ticket);
    setFormData({
      vehicle_id: ticket.vehicle_id,
      customer_id: ticket.customer_id || "",
      ticket_number: ticket.ticket_number,
      date: ticket.date,
      amount: ticket.amount.toString(),
      location: ticket.location || "",
      status: ticket.status,
      driver_declaration: ticket.driver_declaration || false,
      company_declaration: ticket.company_declaration || false,
      paid_date: ticket.paid_date || "",
      notes: ticket.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.vehicle_id || !formData.ticket_number || !formData.date || !formData.amount) {
      toast({ title: "נא למלא שדות חובה", variant: "destructive" });
      return;
    }

    const vehicle = vehicles?.find((v) => v.id === formData.vehicle_id);
    const customer = customers?.find((c) => c.id === formData.customer_id);

    const ticketData = {
      vehicle_id: formData.vehicle_id,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
      customer_id: formData.customer_id || null,
      customer_name: customer
        ? `${customer.first_name} ${customer.last_name}`
        : null,
      ticket_number: formData.ticket_number,
      date: formData.date,
      amount: parseFloat(formData.amount),
      location: formData.location || null,
      status: formData.status,
      driver_declaration: formData.driver_declaration,
      company_declaration: formData.company_declaration,
      paid_date: formData.paid_date || null,
      notes: formData.notes || null,
    };

    if (editingTicket) {
      updateMutation.mutate({ id: editingTicket.id, ...ticketData });
    } else {
      createMutation.mutate(ticketData);
    }
  };

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesSearch =
      ticket.ticket_number.includes(searchQuery) ||
      ticket.vehicle_details?.includes(searchQuery) ||
      ticket.customer_name?.includes(searchQuery) ||
      ticket.location?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="דוחות תנועה"
        subtitle="ניהול דוחות תנועה וקנסות"
        icon={Receipt}
        action={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            דוח חדש
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
                {ticketStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!filteredTickets?.length ? (
            <EmptyState
              icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
              title="אין דוחות תנועה"
              description="לא נמצאו דוחות תנועה במערכת"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>מספר דוח</TableHead>
                    <TableHead>תאריך</TableHead>
                    <TableHead>רכב</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>מיקום</TableHead>
                    <TableHead>סכום</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        {ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ticket.date), "dd/MM/yyyy", { locale: he })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          {ticket.vehicle_details || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{ticket.customer_name || "-"}</TableCell>
                      <TableCell>
                        {ticket.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {ticket.location}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-destructive">
                        ₪{ticket.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(ticket)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(ticket.id)}
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
              {editingTicket ? "עריכת דוח תנועה" : "דוח תנועה חדש"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מספר דוח *</Label>
              <Input
                value={formData.ticket_number}
                onChange={(e) =>
                  setFormData({ ...formData, ticket_number: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>תאריך *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>

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
              <Label>לקוח</Label>
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
                      {customer.first_name} {customer.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>סכום *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>מיקום</Label>
              <Input
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as typeof ticketStatuses[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ticketStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>תאריך תשלום</Label>
              <Input
                type="date"
                value={formData.paid_date}
                onChange={(e) =>
                  setFormData({ ...formData, paid_date: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="driver_declaration"
                  checked={formData.driver_declaration}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, driver_declaration: !!checked })
                  }
                />
                <Label htmlFor="driver_declaration">הצהרת נהג</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="company_declaration"
                  checked={formData.company_declaration}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, company_declaration: !!checked })
                  }
                />
                <Label htmlFor="company_declaration">הצהרת חברה</Label>
              </div>
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
              {editingTicket ? "עדכון" : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
