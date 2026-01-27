import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Edit, Eye, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Tables, TablesInsert, Constants } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

type Accident = Tables<"accidents">;
type Vehicle = Tables<"vehicles">;
type Customer = Tables<"customers">;

const accidentStatuses = Constants.public.Enums.accident_status;
const accidentTypes = Constants.public.Enums.accident_type;

export default function Accidents() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccident, setSelectedAccident] = useState<Accident | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Form data for uploads and other fields
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});

  const { data: accidents = [], isLoading } = useQuery({
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

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TablesInsert<"accidents">) => {
      const { error } = await supabase.from("accidents").insert(data);
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Accident> }) => {
      const { error } = await supabase.from("accidents").update(data).eq("id", id);
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

  const handleCloseDialog = () => {
    setIsOpen(false);
    setSelectedAccident(null);
    setViewMode(false);
    setFormData({});
  };

  const handleFileUpload = async (file: File, field: string) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("accident-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("accident-photos")
        .getPublicUrl(filePath);

      if (field.includes('photos') || field.includes('docs')) {
        const current = (formData[field] as string[]) || [];
        setFormData({ ...formData, [field]: [...current, publicUrl] });
      } else {
        setFormData({ ...formData, [field]: publicUrl });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "שגיאה בהעלאת קובץ", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (field: string, index: number | null = null) => {
    if (index !== null) {
      const current = (formData[field] as string[]) || [];
      setFormData({ ...formData, [field]: current.filter((_, i) => i !== index) });
    } else {
      const newFormData = { ...formData };
      delete newFormData[field];
      setFormData(newFormData);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataObj = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};

    formDataObj.forEach((value, key) => {
      data[key] = value;
    });

    // Merge with uploaded files
    Object.assign(data, formData);

    if (data.estimated_cost) data.estimated_cost = parseFloat(data.estimated_cost as string);
    if (data.actual_cost) data.actual_cost = parseFloat(data.actual_cost as string);

    const customer = customers.find(c => c.id === data.customer_id);
    const vehicle = vehicles.find(v => v.id === data.vehicle_id);

    if (customer) data.customer_name = `${customer.first_name} ${customer.last_name}`;
    if (vehicle) data.vehicle_details = `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`;

    // Handle damage_photos as JSON
    if (formData.damage_photos) {
      data.damage_photos = formData.damage_photos as Json;
    }

    if (selectedAccident) {
      updateMutation.mutate({ id: selectedAccident.id, data: data as Partial<Accident> });
    } else {
      createMutation.mutate(data as TablesInsert<"accidents">);
    }
  };

  const openNewAccident = () => {
    setSelectedAccident(null);
    setViewMode(false);
    setFormData({});
    setIsOpen(true);
  };

  const openViewAccident = (accident: Accident) => {
    setSelectedAccident(accident);
    setViewMode(true);
    // Load existing photos
    if (accident.damage_photos) {
      setFormData({ damage_photos: accident.damage_photos as string[] });
    }
    setIsOpen(true);
  };

  const openEditAccident = (accident: Accident) => {
    setSelectedAccident(accident);
    setViewMode(false);
    // Load existing photos
    if (accident.damage_photos) {
      setFormData({ damage_photos: accident.damage_photos as string[] });
    }
    setIsOpen(true);
  };

  const filteredAccidents = typeFilter === "all"
    ? accidents
    : accidents.filter(a => a.type === typeFilter);

  const openCount = accidents.filter(a => a.status !== "נסגר").length;

  const columns = [
    {
      header: "תאריך",
      cell: (row: Accident) => row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"
    },
    {
      header: "סוג",
      cell: (row: Accident) => (
        <span className={`px-2 py-1 rounded-full text-sm ${
          row.type === "תביעה חיצונית" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"
        }`}>
          {row.type}
        </span>
      )
    },
    {
      header: "לקוח",
      cell: (row: Accident) => row.customer_name || "-"
    },
    {
      header: "רכב",
      cell: (row: Accident) => row.vehicle_details || "-"
    },
    {
      header: "עלות משוערת",
      cell: (row: Accident) => row.estimated_cost ? `₪${row.estimated_cost.toLocaleString()}` : "-"
    },
    {
      header: "סטטוס",
      cell: (row: Accident) => <StatusBadge status={row.status || "פתוח"} />
    },
    {
      header: "פעולות",
      cell: (row: Accident) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openViewAccident(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditAccident(row)}
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
        title="תאונות ותביעות"
        subtitle={`${openCount} תיקים פתוחים`}
        action={openNewAccident}
        actionLabel="תאונה חדשה"
        actionIcon={AlertTriangle}
      />

      <div className="mb-6">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {accidentTypes.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredAccidents}
        isLoading={isLoading}
        emptyMessage="לא נמצאו תאונות"
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode ? "פרטי תאונה" : selectedAccident ? "עריכת תאונה" : "תאונה חדשה"}
            </DialogTitle>
          </DialogHeader>

          {viewMode && selectedAccident ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">תאריך</Label>
                  <p className="font-medium">
                    {selectedAccident.date ? format(new Date(selectedAccident.date), "dd/MM/yyyy") : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סוג</Label>
                  <p className="font-medium">{selectedAccident.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">לקוח</Label>
                  <p className="font-medium">{selectedAccident.customer_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">רכב</Label>
                  <p className="font-medium">{selectedAccident.vehicle_details}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">תיאור</Label>
                <p>{selectedAccident.description || "-"}</p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-3">פרטי הצד השני</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">שם:</span> {selectedAccident.other_party_name || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">טלפון:</span> {selectedAccident.other_party_phone || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ת.ז.:</span> {selectedAccident.other_party_id || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">רכב:</span> {selectedAccident.other_vehicle_plate || "-"}
                  </div>
                </div>
              </div>

              {/* View damage photos */}
              {selectedAccident.damage_photos && (selectedAccident.damage_photos as string[]).length > 0 && (
                <div>
                  <Label className="text-muted-foreground">תמונות נזק</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {(selectedAccident.damage_photos as string[]).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`נזק ${i + 1}`}
                        className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">עלות משוערת</Label>
                  <p className="font-medium">₪{selectedAccident.estimated_cost?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">עלות בפועל</Label>
                  <p className="font-medium">₪{selectedAccident.actual_cost?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">מספר תביעה</Label>
                  <p className="font-medium">{selectedAccident.insurance_claim_number || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <StatusBadge status={selectedAccident.status} />
                </div>
              </div>

              <Button onClick={() => setViewMode(false)} className="w-full bg-primary hover:bg-primary/90">
                עריכה
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic">פרטי התאונה</TabsTrigger>
                  <TabsTrigger value="documents">מסמכים</TabsTrigger>
                  <TabsTrigger value="other">הצד השני</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>סוג *</Label>
                      <Select name="type" defaultValue={selectedAccident?.type || "תביעה פנימית"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accidentTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>תאריך *</Label>
                      <Input name="date" type="date" defaultValue={selectedAccident?.date} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>רכב *</Label>
                      <Select name="vehicle_id" defaultValue={selectedAccident?.vehicle_id}>
                        <SelectTrigger><SelectValue placeholder="בחר רכב" /></SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.manufacturer} {v.model} - {v.license_plate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>לקוח</Label>
                      <Select name="customer_id" defaultValue={selectedAccident?.customer_id || undefined}>
                        <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                        <SelectContent>
                          {customers.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.first_name} {c.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>תיאור האירוע</Label>
                    <Textarea name="description" defaultValue={selectedAccident?.description || ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>עלות משוערת</Label>
                      <Input name="estimated_cost" type="number" defaultValue={selectedAccident?.estimated_cost || ""} />
                    </div>
                    <div>
                      <Label>עלות בפועל</Label>
                      <Input name="actual_cost" type="number" defaultValue={selectedAccident?.actual_cost || ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>סטטוס</Label>
                      <Select name="status" defaultValue={selectedAccident?.status || "פתוח"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accidentStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>מספר תביעה בביטוח</Label>
                      <Input name="insurance_claim_number" defaultValue={selectedAccident?.insurance_claim_number || ""} />
                    </div>
                  </div>
                  <div>
                    <Label>הערות</Label>
                    <Textarea name="notes" defaultValue={selectedAccident?.notes || ""} />
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">מסמכים - הרכב שלנו</h3>

                  {/* Damage Photos */}
                  <div>
                    <Label>תמונות נזק</Label>
                    <div className="mt-2 space-y-2">
                      {((formData.damage_photos as string[]) || []).map((url, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <img src={url} alt="נזק" className="w-16 h-16 object-cover rounded" />
                          <span className="flex-1 text-sm truncate">{url.split('/').pop()}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFile('damage_photos', i)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploading}
                          onChange={async (e) => {
                            if (e.target.files) {
                              for (const file of Array.from(e.target.files)) {
                                await handleFileUpload(file, 'damage_photos');
                              }
                            }
                          }}
                        />
                        <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {uploading ? "מעלה..." : "העלה תמונות נזק"}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="other" className="space-y-4">
                  <h3 className="font-semibold text-lg mb-4">פרטי הצד השני</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>שם הצד השני</Label>
                      <Input name="other_party_name" defaultValue={selectedAccident?.other_party_name || ""} />
                    </div>
                    <div>
                      <Label>טלפון</Label>
                      <Input name="other_party_phone" defaultValue={selectedAccident?.other_party_phone || ""} />
                    </div>
                    <div>
                      <Label>ת.ז.</Label>
                      <Input name="other_party_id" defaultValue={selectedAccident?.other_party_id || ""} />
                    </div>
                    <div>
                      <Label>מספר רכב</Label>
                      <Input name="other_vehicle_plate" defaultValue={selectedAccident?.other_vehicle_plate || ""} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 mt-4 border-t">
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={uploading}>
                  {selectedAccident ? "עדכון" : "יצירה"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  ביטול
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
