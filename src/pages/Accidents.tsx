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
import { AlertTriangle, Plus, Search, Pencil, Trash2, Car, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";

type Accident = Tables<"accidents">;
type Vehicle = Tables<"vehicles">;
type Customer = Tables<"customers">;

const accidentStatuses = Constants.public.Enums.accident_status;
const accidentTypes = Constants.public.Enums.accident_type;

export default function Accidents() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccident, setEditingAccident] = useState<Accident | null>(null);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    customer_id: "",
    date: "",
    type: "" as typeof accidentTypes[number] | "",
    description: "",
    status: "פתוח" as typeof accidentStatuses[number],
    other_party_name: "",
    other_party_phone: "",
    other_party_id: "",
    other_vehicle_plate: "",
    insurance_claim_number: "",
    estimated_cost: "",
    actual_cost: "",
    notes: "",
  });

  const { data: accidents, isLoading } = useQuery({
    queryKey: ["accidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accidents")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as Accident[];
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
    mutationFn: async (accident: TablesInsert<"accidents">) => {
      const { error } = await supabase.from("accidents").insert(accident);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accidents"] });
      toast({ title: "תאונה נוספה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה בהוספת תאונה", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...accident }: Partial<Accident> & { id: string }) => {
      const { error } = await supabase
        .from("accidents")
        .update(accident)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accidents"] });
      toast({ title: "תאונה עודכנה בהצלחה" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "שגיאה בעדכון תאונה", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accidents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accidents"] });
      toast({ title: "תאונה נמחקה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה במחיקת תאונה", variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAccident(null);
    setFormData({
      vehicle_id: "",
      customer_id: "",
      date: "",
      type: "",
      description: "",
      status: "פתוח",
      other_party_name: "",
      other_party_phone: "",
      other_party_id: "",
      other_vehicle_plate: "",
      insurance_claim_number: "",
      estimated_cost: "",
      actual_cost: "",
      notes: "",
    });
  };

  const handleEdit = (accident: Accident) => {
    setEditingAccident(accident);
    setFormData({
      vehicle_id: accident.vehicle_id,
      customer_id: accident.customer_id || "",
      date: accident.date,
      type: accident.type,
      description: accident.description || "",
      status: accident.status,
      other_party_name: accident.other_party_name || "",
      other_party_phone: accident.other_party_phone || "",
      other_party_id: accident.other_party_id || "",
      other_vehicle_plate: accident.other_vehicle_plate || "",
      insurance_claim_number: accident.insurance_claim_number || "",
      estimated_cost: accident.estimated_cost?.toString() || "",
      actual_cost: accident.actual_cost?.toString() || "",
      notes: accident.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.vehicle_id || !formData.date || !formData.type) {
      toast({ title: "נא למלא שדות חובה", variant: "destructive" });
      return;
    }

    const vehicle = vehicles?.find((v) => v.id === formData.vehicle_id);
    const customer = customers?.find((c) => c.id === formData.customer_id);

    const accidentData = {
      vehicle_id: formData.vehicle_id,
      vehicle_details: vehicle
        ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`
        : null,
      customer_id: formData.customer_id || null,
      customer_name: customer
        ? `${customer.first_name} ${customer.last_name}`
        : null,
      date: formData.date,
      type: formData.type as typeof accidentTypes[number],
      description: formData.description || null,
      status: formData.status,
      other_party_name: formData.other_party_name || null,
      other_party_phone: formData.other_party_phone || null,
      other_party_id: formData.other_party_id || null,
      other_vehicle_plate: formData.other_vehicle_plate || null,
      insurance_claim_number: formData.insurance_claim_number || null,
      estimated_cost: formData.estimated_cost
        ? parseFloat(formData.estimated_cost)
        : null,
      actual_cost: formData.actual_cost
        ? parseFloat(formData.actual_cost)
        : null,
      notes: formData.notes || null,
    };

    if (editingAccident) {
      updateMutation.mutate({ id: editingAccident.id, ...accidentData });
    } else {
      createMutation.mutate(accidentData);
    }
  };

  const filteredAccidents = accidents?.filter((accident) => {
    const matchesSearch =
      accident.vehicle_details?.includes(searchQuery) ||
      accident.customer_name?.includes(searchQuery) ||
      accident.insurance_claim_number?.includes(searchQuery);
    const matchesStatus =
      statusFilter === "all" || accident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="תאונות"
        subtitle="ניהול תאונות ותביעות ביטוח"
        icon={AlertTriangle}
        action={
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 ml-2" />
            תאונה חדשה
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
                {accidentStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!filteredAccidents?.length ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}
              title="אין תאונות"
              description="לא נמצאו תאונות במערכת"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>רכב</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>מספר תביעה</TableHead>
                    <TableHead>עלות משוערת</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccidents.map((accident) => (
                    <TableRow key={accident.id}>
                      <TableCell>
                        {format(new Date(accident.date), "dd/MM/yyyy", {
                          locale: he,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          {accident.vehicle_details || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {accident.customer_name && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {accident.customer_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{accident.type}</TableCell>
                      <TableCell>
                        {accident.insurance_claim_number || "-"}
                      </TableCell>
                      <TableCell>
                        {accident.estimated_cost
                          ? `₪${accident.estimated_cost.toLocaleString()}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={accident.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(accident)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(accident.id)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccident ? "עריכת תאונה" : "תאונה חדשה"}
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
                      {vehicle.manufacturer} {vehicle.model} -{" "}
                      {vehicle.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>לקוח (נהג)</Label>
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
              <Label>סוג תאונה *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as typeof accidentTypes[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג" />
                </SelectTrigger>
                <SelectContent>
                  {accidentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
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
                    status: value as typeof accidentStatuses[number],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accidentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>מספר תביעת ביטוח</Label>
              <Input
                value={formData.insurance_claim_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    insurance_claim_number: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <h4 className="font-semibold border-b pb-2">פרטי הצד השני</h4>
            </div>

            <div className="space-y-2">
              <Label>שם</Label>
              <Input
                value={formData.other_party_name}
                onChange={(e) =>
                  setFormData({ ...formData, other_party_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                value={formData.other_party_phone}
                onChange={(e) =>
                  setFormData({ ...formData, other_party_phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>ת.ז</Label>
              <Input
                value={formData.other_party_id}
                onChange={(e) =>
                  setFormData({ ...formData, other_party_id: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>מספר רכב</Label>
              <Input
                value={formData.other_vehicle_plate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    other_vehicle_plate: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-4 md:col-span-2">
              <h4 className="font-semibold border-b pb-2">עלויות</h4>
            </div>

            <div className="space-y-2">
              <Label>עלות משוערת</Label>
              <Input
                type="number"
                value={formData.estimated_cost}
                onChange={(e) =>
                  setFormData({ ...formData, estimated_cost: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>עלות בפועל</Label>
              <Input
                type="number"
                value={formData.actual_cost}
                onChange={(e) =>
                  setFormData({ ...formData, actual_cost: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>תיאור התאונה</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
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
              {editingAccident ? "עדכון" : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
