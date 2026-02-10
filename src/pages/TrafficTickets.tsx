import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileWarning, Car, Edit, Check, Trash2, Send, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CustomerSearchSelect } from "@/components/shared/CustomerSearchSelect";
import type { Tables } from "@/integrations/supabase/types";

type TrafficTicket = Tables<"traffic_tickets">;
type Vehicle = Tables<"vehicles">;
type Customer = Tables<"customers">;
type Rental = Tables<"rentals">;
type Booking = Tables<"bookings">;

export default function TrafficTickets() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TrafficTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState({ 
    ticket_number: "", 
    date: "", 
    location: "",
    vehicle_id: "",
    customer_id: "",
    amount: "",
    status: "חדש" as "חדש" | "הועבר ללקוח" | "שולם" | "בערעור",
    driver_declaration: false,
    company_declaration: false,
    notes: "",
    auto_customer: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["trafficTickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traffic_tickets")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as TrafficTicket[];
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
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

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*");
      if (error) throw error;
      return data as Rental[];
    }
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*");
      if (error) throw error;
      return data as Booking[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<TrafficTicket>) => {
      const { error } = await supabase.from("traffic_tickets").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trafficTickets"] });
      setIsOpen(false);
      setSelectedTicket(null);
      toast({ title: "דוח נוצר בהצלחה" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TrafficTicket> }) => {
      const { error } = await supabase.from("traffic_tickets").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trafficTickets"] });
      setIsOpen(false);
      setSelectedTicket(null);
      toast({ title: "דוח עודכן בהצלחה" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("traffic_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trafficTickets"] });
      toast({ title: "דוח נמחק בהצלחה" });
    }
  });

  const autoAssignCustomer = (date: string, vehicleId: string) => {
    if (!date || !vehicleId) return null;
    
    const rental = rentals.find(r => 
      r.vehicle_id === vehicleId && 
      r.status === "פעיל" &&
      r.start_date <= date &&
      (r.planned_end_date || "") >= date
    );
    
    return rental ? { id: rental.customer_id, name: rental.customer_name } : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
    let customerName = formData.auto_customer;
    let customerId = formData.customer_id;
    
    // Auto-assign customer if not selected
    if (!formData.customer_id && formData.date && formData.vehicle_id) {
      const assignedCustomer = autoAssignCustomer(formData.date, formData.vehicle_id);
      if (assignedCustomer) {
        customerId = assignedCustomer.id || "";
        customerName = assignedCustomer.name || "";
      }
    } else if (formData.customer_id) {
      const customer = customers.find(c => c.id === formData.customer_id);
      if (customer) customerName = `${customer.first_name} ${customer.last_name}`;
    }

    const data: Partial<TrafficTicket> = {
      ticket_number: formData.ticket_number,
      date: formData.date,
      location: formData.location,
      vehicle_id: formData.vehicle_id,
      vehicle_details: vehicle ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}` : null,
      customer_id: customerId || null,
      customer_name: customerName || null,
      amount: parseFloat(formData.amount),
      status: formData.status,
      driver_declaration: formData.driver_declaration,
      company_declaration: formData.company_declaration,
      notes: formData.notes || null
    };

    if (selectedTicket) {
      updateMutation.mutate({ id: selectedTicket.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDateVehicleChange = (newDate?: string, newVehicleId?: string) => {
    const date = newDate || formData.date;
    const vehicleId = newVehicleId || formData.vehicle_id;
    
    if (date && vehicleId) {
      const assignedCustomer = autoAssignCustomer(date, vehicleId);
      if (assignedCustomer) {
        setFormData(prev => ({ ...prev, auto_customer: assignedCustomer.name || "" }));
      }
    }
  };

  const transferToCustomer = async (ticket: TrafficTicket) => {
    try {
      // Update ticket status
      await supabase
        .from("traffic_tickets")
        .update({ status: "הועבר ללקוח" })
        .eq("id", ticket.id);
      
      // Create collection task
      await supabase.from("collection_tasks").insert({
        customer_id: ticket.customer_id,
        customer_name: ticket.customer_name,
        vehicle_id: ticket.vehicle_id,
        vehicle_details: ticket.vehicle_details,
        debt_date: ticket.date,
        amount: ticket.amount,
        reason: `דוח תנועה מספר ${ticket.ticket_number}`,
        status: "פתוח"
      });
      
      queryClient.invalidateQueries({ queryKey: ["trafficTickets"] });
      queryClient.invalidateQueries({ queryKey: ["collectionTasks"] });
      toast({ title: "הדוח הועבר ללקוח" });
    } catch (error) {
      toast({ title: "שגיאה בהעברת הדוח", variant: "destructive" });
    }
  };

  const markPaid = async (ticket: TrafficTicket) => {
    await supabase
      .from("traffic_tickets")
      .update({ status: "שולם", paid_date: format(new Date(), "yyyy-MM-dd") })
      .eq("id", ticket.id);
    queryClient.invalidateQueries({ queryKey: ["trafficTickets"] });
    toast({ title: "הדוח סומן כשולם" });
  };

  const downloadDocuments = async (ticket: TrafficTicket) => {
    if (!ticket.customer_id) {
      toast({ title: "לא נמצא לקוח משויך לדוח", variant: "destructive" });
      return;
    }

    const customer = customers.find(c => c.id === ticket.customer_id);
    const rental = rentals.find(r => 
      r.customer_id === ticket.customer_id &&
      r.vehicle_id === ticket.vehicle_id &&
      r.start_date <= ticket.date &&
      (r.actual_end_date || r.planned_end_date || "") >= ticket.date
    );

    if (!customer) {
      toast({ title: "לא נמצא לקוח", variant: "destructive" });
      return;
    }

    const documents: { url: string; name: string }[] = [];
    
    // Get booking for contract and waiver URLs
    const booking = rental?.booking_id ? bookings.find(b => b.id === rental.booking_id) : null;
    
    // Contract
    if (booking?.contract_url) {
      documents.push({ url: booking.contract_url, name: "חוזה" });
    }
    
    // Driver declaration
    if (booking?.waiver_url) {
      documents.push({ url: booking.waiver_url, name: "הצהרת נהג" });
    }
    
    // Declaration URL
    if (ticket.declaration_url) {
      documents.push({ url: ticket.declaration_url, name: "הצהרת חברה" });
    }
    
    // Driver's license
    if (customer.license_front_url) {
      documents.push({ url: customer.license_front_url, name: "רישיון קדמי" });
    }
    if (customer.license_back_url) {
      documents.push({ url: customer.license_back_url, name: "רישיון אחורי" });
    }

    if (documents.length === 0) {
      toast({ title: "לא נמצאו מסמכים להורדה", variant: "destructive" });
      return;
    }

    // Open all documents
    documents.forEach(doc => {
      window.open(doc.url, '_blank');
    });
    
    toast({ title: `נפתחו ${documents.length} מסמכים` });
  };

  const openEditDialog = (ticket: TrafficTicket) => {
    setSelectedTicket(ticket);
    setFormData({
      ticket_number: ticket.ticket_number,
      date: ticket.date,
      location: ticket.location || "",
      vehicle_id: ticket.vehicle_id,
      customer_id: ticket.customer_id || "",
      amount: ticket.amount.toString(),
      status: ticket.status,
      driver_declaration: ticket.driver_declaration || false,
      company_declaration: ticket.company_declaration || false,
      notes: ticket.notes || "",
      auto_customer: ticket.customer_name || ""
    });
    setIsOpen(true);
  };

  const openNewDialog = () => {
    setSelectedTicket(null);
    setFormData({
      ticket_number: "",
      date: "",
      location: "",
      vehicle_id: "",
      customer_id: "",
      amount: "",
      status: "חדש",
      driver_declaration: false,
      company_declaration: false,
      notes: "",
      auto_customer: ""
    });
    setIsOpen(true);
  };

  const filteredTickets = statusFilter === "all" 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter);

  const totalUnpaid = tickets
    .filter(t => t.status !== "שולם")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const newCount = tickets.filter(t => t.status === "חדש").length;

  const columns = [
    {
      header: "מספר דוח",
      accessorKey: "ticket_number" as const
    },
    {
      header: "תאריך",
      cell: (row: TrafficTicket) => row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"
    },
    {
      header: "רכב",
      cell: (row: TrafficTicket) => row.vehicle_details || "-"
    },
    {
      header: "מיקום",
      accessorKey: "location" as const
    },
    {
      header: "סכום",
      cell: (row: TrafficTicket) => (
        <span className="font-bold text-red-600">₪{row.amount?.toLocaleString() || 0}</span>
      )
    },
    {
      header: "לקוח",
      cell: (row: TrafficTicket) => row.customer_name || "-"
    },
    {
      header: "סטטוס",
      cell: (row: TrafficTicket) => <StatusBadge status={row.status || "חדש"} />
    },
    {
      header: "פעולות",
      cell: (row: TrafficTicket) => (
        <div className="flex gap-1 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            className="text-purple-600"
            onClick={async () => {
              setIsProcessing(true);
              try {
                await downloadDocuments(row);
              } finally {
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
            title="הורד מסמכים"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
          {row.status === "חדש" && (
            <Button 
              size="sm" 
              variant="outline"
              className="text-blue-600"
              onClick={() => transferToCustomer(row)}
              title="העבר ללקוח"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
          {row.status !== "שולם" && (
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => markPaid(row)}
              title="סמן כשולם"
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => openEditDialog(row)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-red-500"
            onClick={() => deleteMutation.mutate(row.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="דוחות תנועה"
        subtitle={`${newCount} דוחות חדשים`}
        icon={FileWarning}
        action={
          <Button onClick={openNewDialog} className="bg-cyan-600 hover:bg-cyan-700">
            <FileWarning className="w-4 h-4 ml-2" />
            דוח חדש
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="דוחות חדשים"
          value={newCount}
          icon={FileWarning}
          color="red"
        />
        <StatCard
          title="סה״כ לא שולם"
          value={`₪${totalUnpaid.toLocaleString()}`}
          icon={FileText}
          color="orange"
        />
        <StatCard
          title="סה״כ דוחות"
          value={tickets.length}
          icon={Car}
          color="blue"
        />
      </div>

      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="חדש">חדש</SelectItem>
            <SelectItem value="הועבר ללקוח">הועבר ללקוח</SelectItem>
            <SelectItem value="שולם">שולם</SelectItem>
            <SelectItem value="בערעור">בערעור</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredTickets}
        isLoading={isLoading}
        emptyMessage="לא נמצאו דוחות תנועה"
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTicket ? "עריכת דוח" : "דוח תנועה חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מספר דוח *</Label>
                <Input 
                  value={formData.ticket_number}
                  onChange={(e) => setFormData({ ...formData, ticket_number: e.target.value })}
                  required 
                />
              </div>
              <div>
                <Label>תאריך *</Label>
                <Input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => {
                    setFormData({ ...formData, date: e.target.value });
                    handleDateVehicleChange(e.target.value);
                  }}
                  required 
                />
              </div>
            </div>
            <div>
              <Label>רכב *</Label>
              <Select 
                value={formData.vehicle_id}
                onValueChange={(v) => {
                  setFormData({ ...formData, vehicle_id: v });
                  handleDateVehicleChange(undefined, v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר רכב" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.manufacturer} {v.model} - {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {formData.auto_customer && (
              <div className="p-3 bg-blue-50 rounded text-sm text-blue-800">
                ✓ שוייך אוטומטית ללקוח: {formData.auto_customer}
              </div>
            )}
            <div>
              <Label>לקוח (נהג)</Label>
              <CustomerSearchSelect
                customers={customers}
                value={formData.customer_id}
                onValueChange={(v) => setFormData({ ...formData, customer_id: v })}
                placeholder="בחר לקוח"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>מיקום/עירייה</Label>
                <Input 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="עירייה או משטרה"
                />
              </div>
              <div>
                <Label>סכום *</Label>
                <Input 
                  type="number" 
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required 
                />
              </div>
            </div>
            <div>
              <Label>סטטוס</Label>
              <Select 
                value={formData.status}
                onValueChange={(v: any) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="חדש">חדש</SelectItem>
                  <SelectItem value="הועבר ללקוח">הועבר ללקוח</SelectItem>
                  <SelectItem value="שולם">שולם</SelectItem>
                  <SelectItem value="בערעור">בערעור</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="driver_declaration" 
                  checked={formData.driver_declaration}
                  onCheckedChange={(checked) => setFormData({ ...formData, driver_declaration: !!checked })}
                />
                <Label htmlFor="driver_declaration">הצהרת נהג</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="company_declaration" 
                  checked={formData.company_declaration}
                  onCheckedChange={(checked) => setFormData({ ...formData, company_declaration: !!checked })}
                />
                <Label htmlFor="company_declaration">הצהרת חברה</Label>
              </div>
            </div>
            <div>
              <Label>הערות</Label>
              <Textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                {selectedTicket ? "עדכון" : "יצירה"}
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
