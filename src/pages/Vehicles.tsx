import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Search, Filter, Plus, Fuel, Gauge, Edit, Trash2, Calendar, Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/formatters";
import { motion } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
type VehicleType = Database["public"]["Enums"]["vehicle_type"];
type FuelType = Database["public"]["Enums"]["fuel_type"];

const statusOptions: VehicleStatus[] = ["זמין", "מושכר", "בטיפול", "תאונה", "לא פעיל", "נמכר"];
const vehicleTypeOptions: VehicleType[] = ["5 מקומות", "7 מקומות"];
const fuelTypeOptions: FuelType[] = ["בנזין", "דיזל", "היברידי", "חשמלי"];

const statusColors: Record<string, string> = {
  "זמין": "border-green-200 bg-green-50",
  "מושכר": "border-blue-200 bg-blue-50",
  "בטיפול": "border-orange-200 bg-orange-50",
  "תאונה": "border-red-200 bg-red-50",
  "לא פעיל": "border-gray-200 bg-gray-50",
  "נמכר": "border-purple-200 bg-purple-50"
};

export default function Vehicles() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [formState, setFormState] = useState<Partial<Vehicle>>({});
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (vehicle: VehicleInsert) => {
      const { error } = await supabase.from("vehicles").insert(vehicle);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      closeDialog();
      toast({ title: "הרכב נוסף בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...vehicle }: Partial<Vehicle> & { id: string }) => {
      const { error } = await supabase.from("vehicles").update(vehicle).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      closeDialog();
      toast({ title: "הרכב עודכן בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "הרכב נמחק בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const filteredVehicles = vehicles?.filter((vehicle) => {
    const matchesSearch =
      vehicle.license_plate.includes(searchQuery) ||
      vehicle.manufacturer.includes(searchQuery) ||
      vehicle.model.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || vehicle.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("vehicle-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("vehicle-images")
        .getPublicUrl(filePath);

      setFormState(prev => ({ ...prev, image_url: urlData.publicUrl }));
      toast({ title: "התמונה הועלתה בהצלחה" });
    } catch (error: any) {
      toast({ title: "שגיאה בהעלאת התמונה", description: error.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const vehicleData: VehicleInsert = {
      license_plate: formState.license_plate || "",
      manufacturer: formState.manufacturer || "",
      model: formState.model || "",
      color: formState.color || null,
      year: formState.year ? Number(formState.year) : null,
      vehicle_type: formState.vehicle_type as VehicleType || null,
      fuel_type: formState.fuel_type as FuelType || null,
      current_km: formState.current_km ? Number(formState.current_km) : 0,
      daily_rate: formState.daily_rate ? Number(formState.daily_rate) : null,
      half_day_rate: formState.half_day_rate ? Number(formState.half_day_rate) : null,
      monthly_rate: formState.monthly_rate ? Number(formState.monthly_rate) : null,
      weekly_rate: formState.weekly_rate ? Number(formState.weekly_rate) : null,
      km_limit: formState.km_limit ? Number(formState.km_limit) : null,
      extra_km_price: formState.extra_km_price ? Number(formState.extra_km_price) : null,
      hourly_delay_rate: formState.hourly_delay_rate ? Number(formState.hourly_delay_rate) : null,
      status: (formState.status as VehicleStatus) || "זמין",
      notes: formState.notes || null,
      image_url: formState.image_url || null,
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, ...vehicleData });
    } else {
      createMutation.mutate(vehicleData);
    }
  };

  const openViewDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormState(vehicle);
    setViewMode(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormState(vehicle);
    setViewMode(false);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingVehicle(null);
    setFormState({});
    setViewMode(false);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingVehicle(null);
    setFormState({});
    setViewMode(false);
  };

  const availableCount = vehicles?.filter(v => v.status === "זמין").length || 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="רכבים"
        subtitle={`${vehicles?.length || 0} רכבים | ${availableCount} זמינים`}
        icon={Car}
        action={
          <Button onClick={openNewDialog} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="ml-2 h-4 w-4" />
            רכב חדש
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="חיפוש לפי מספר רישוי, יצרן או דגם..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="סינון סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vehicles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredVehicles && filteredVehicles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle, i) => (
            <motion.div
              key={vehicle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                onClick={() => openViewDialog(vehicle)}
                className={`p-5 border-2 transition-all duration-300 hover:shadow-lg cursor-pointer ${statusColors[vehicle.status] || 'border-gray-200'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {vehicle.manufacturer} {vehicle.model}
                    </h3>
                    <p className="text-gray-500 text-sm">{vehicle.license_plate}</p>
                  </div>
                  <StatusBadge status={vehicle.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{vehicle.year || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Fuel className="w-4 h-4" />
                    <span>{vehicle.fuel_type || "-"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Gauge className="w-4 h-4" />
                    <span>{formatNumber(vehicle.current_km || 0)} ק"מ</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Car className="w-4 h-4" />
                    <span>{vehicle.vehicle_type || "-"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-cyan-600 font-bold">
                    ₪{vehicle.daily_rate?.toLocaleString() || 0} / יום
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(vehicle)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500"
                      onClick={() => deleteMutation.mutate(vehicle.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Car className="h-8 w-8 text-muted-foreground" />}
          title="לא נמצאו רכבים"
          description="לא נמצאו רכבים התואמים לחיפוש"
          action={
            <Button onClick={openNewDialog} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
              <Plus className="h-4 w-4" />
              הוסף רכב
            </Button>
          }
        />
      )}

      {/* View/Edit Vehicle Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode ? "פרטי רכב" : editingVehicle ? "עריכת רכב" : "רכב חדש"}
            </DialogTitle>
          </DialogHeader>

          {viewMode && editingVehicle ? (
            <div className="space-y-6">
              {/* Vehicle Image */}
              {editingVehicle.image_url && (
                <img 
                  src={editingVehicle.image_url} 
                  alt={`${editingVehicle.manufacturer} ${editingVehicle.model}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-500">מספר רישוי</Label>
                  <p className="font-medium">{editingVehicle.license_plate}</p>
                </div>
                <div>
                  <Label className="text-gray-500">יצרן / דגם</Label>
                  <p className="font-medium">{editingVehicle.manufacturer} {editingVehicle.model}</p>
                </div>
                <div>
                  <Label className="text-gray-500">שנת ייצור</Label>
                  <p className="font-medium">{editingVehicle.year || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">צבע</Label>
                  <p className="font-medium">{editingVehicle.color || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">סוג דלק</Label>
                  <p className="font-medium">{editingVehicle.fuel_type || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">ק"מ נוכחי</Label>
                  <p className="font-medium">{formatNumber(editingVehicle.current_km || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-cyan-50 rounded-xl">
                <div className="text-center">
                  <p className="text-sm text-gray-500">יומי</p>
                  <p className="font-bold text-cyan-600">₪{editingVehicle.daily_rate || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">חצי יום</p>
                  <p className="font-bold text-cyan-600">₪{editingVehicle.half_day_rate || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">חודשי</p>
                  <p className="font-bold text-cyan-600">₪{editingVehicle.monthly_rate || 0}</p>
                </div>
              </div>

              {editingVehicle.notes && (
                <div>
                  <Label className="text-gray-500">הערות</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded">{editingVehicle.notes}</p>
                </div>
              )}

              <Button onClick={() => setViewMode(false)} className="w-full bg-cyan-600 hover:bg-cyan-700">
                עריכה
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic">בסיסי</TabsTrigger>
                  <TabsTrigger value="rates">תעריפים</TabsTrigger>
                  <TabsTrigger value="image">תמונה</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>מספר רישוי *</Label>
                      <Input 
                        name="license_plate" 
                        value={formState.license_plate || ''} 
                        onChange={handleFieldChange}
                        required 
                      />
                    </div>
                    <div>
                      <Label>סוג רכב</Label>
                      <Select 
                        value={formState.vehicle_type || ''}
                        onValueChange={(v) => handleSelectChange('vehicle_type', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוג" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypeOptions.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>יצרן *</Label>
                      <Input 
                        name="manufacturer" 
                        value={formState.manufacturer || ''} 
                        onChange={handleFieldChange}
                        required 
                      />
                    </div>
                    <div>
                      <Label>דגם *</Label>
                      <Input 
                        name="model" 
                        value={formState.model || ''} 
                        onChange={handleFieldChange}
                        required 
                      />
                    </div>
                    <div>
                      <Label>צבע</Label>
                      <Input 
                        name="color" 
                        value={formState.color || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>שנת ייצור</Label>
                      <Input 
                        name="year" 
                        type="number" 
                        value={formState.year || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>סוג דלק</Label>
                      <Select 
                        value={formState.fuel_type || ''}
                        onValueChange={(v) => handleSelectChange('fuel_type', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוג דלק" />
                        </SelectTrigger>
                        <SelectContent>
                          {fuelTypeOptions.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>סטטוס</Label>
                      <Select 
                        value={formState.status || 'זמין'}
                        onValueChange={(v) => handleSelectChange('status', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>ק"מ נוכחי</Label>
                      <Input 
                        name="current_km" 
                        type="number" 
                        value={formState.current_km || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>הערות</Label>
                    <Textarea 
                      name="notes" 
                      value={formState.notes || ''} 
                      onChange={handleFieldChange}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="rates" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>תעריף יומי</Label>
                      <Input 
                        name="daily_rate" 
                        type="number" 
                        value={formState.daily_rate || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>תעריף חצי יום</Label>
                      <Input 
                        name="half_day_rate" 
                        type="number" 
                        value={formState.half_day_rate || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>תעריף חודשי</Label>
                      <Input 
                        name="monthly_rate" 
                        type="number" 
                        value={formState.monthly_rate || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>הגבלת ק"מ</Label>
                      <Input 
                        name="km_limit" 
                        type="number" 
                        value={formState.km_limit || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>מחיר קילומטר נוסף</Label>
                      <Input 
                        name="extra_km_price" 
                        type="number" 
                        step="0.1" 
                        value={formState.extra_km_price || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                    <div>
                      <Label>תעריף איחור שעתי</Label>
                      <Input 
                        name="hourly_delay_rate" 
                        type="number" 
                        value={formState.hourly_delay_rate || ''} 
                        onChange={handleFieldChange}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="image" className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="vehicle-image-input"
                      disabled={uploadingImage}
                    />
                    <label htmlFor="vehicle-image-input" className="cursor-pointer">
                      {uploadingImage ? (
                        <Loader2 className="w-12 h-12 mx-auto mb-3 text-cyan-600 animate-spin" />
                      ) : (
                        <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      )}
                      <p className="text-lg font-medium mb-1">
                        {uploadingImage ? "מעלה תמונה..." : "לחץ להעלאת תמונה"}
                      </p>
                    </label>
                  </div>
                  {formState.image_url && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">תמונה נוכחית:</p>
                      <img 
                        src={formState.image_url} 
                        alt="תמונת רכב"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4 mt-4 border-t">
                <Button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700">
                  {editingVehicle ? "עדכון" : "יצירה"}
                </Button>
                <Button type="button" variant="outline" onClick={closeDialog}>
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
