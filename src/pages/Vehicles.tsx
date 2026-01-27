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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, Search, Filter, Plus, Fuel, Gauge, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { Database } from "@/integrations/supabase/types";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
type VehicleType = Database["public"]["Enums"]["vehicle_type"];
type FuelType = Database["public"]["Enums"]["fuel_type"];

const statusOptions: VehicleStatus[] = ["זמין", "מושכר", "בטיפול", "תאונה", "לא פעיל", "נמכר"];
const vehicleTypeOptions: VehicleType[] = ["5 מקומות", "7 מקומות"];
const fuelTypeOptions: FuelType[] = ["בנזין", "דיזל", "היברידי", "חשמלי"];

export default function Vehicles() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

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
      setIsDialogOpen(false);
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
      setIsDialogOpen(false);
      setEditingVehicle(null);
      toast({ title: "הרכב עודכן בהצלחה" });
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const vehicleData: VehicleInsert = {
      license_plate: formData.get("license_plate") as string,
      manufacturer: formData.get("manufacturer") as string,
      model: formData.get("model") as string,
      color: formData.get("color") as string || null,
      year: formData.get("year") ? parseInt(formData.get("year") as string) : null,
      vehicle_type: formData.get("vehicle_type") as VehicleType || null,
      fuel_type: formData.get("fuel_type") as FuelType || null,
      current_km: formData.get("current_km") ? parseFloat(formData.get("current_km") as string) : 0,
      daily_rate: formData.get("daily_rate") ? parseFloat(formData.get("daily_rate") as string) : null,
      half_day_rate: formData.get("half_day_rate") ? parseFloat(formData.get("half_day_rate") as string) : null,
      monthly_rate: formData.get("monthly_rate") ? parseFloat(formData.get("monthly_rate") as string) : null,
      km_limit: formData.get("km_limit") ? parseFloat(formData.get("km_limit") as string) : null,
      extra_km_price: formData.get("extra_km_price") ? parseFloat(formData.get("extra_km_price") as string) : null,
      hourly_delay_rate: formData.get("hourly_delay_rate") ? parseFloat(formData.get("hourly_delay_rate") as string) : null,
      status: (formData.get("status") as VehicleStatus) || "זמין",
      notes: formData.get("notes") as string || null,
    };

    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, ...vehicleData });
    } else {
      createMutation.mutate(vehicleData);
    }
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingVehicle(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="רכבים"
        subtitle="ניהול צי הרכבים"
        icon={Car}
        action={<Button onClick={() => setIsDialogOpen(true)}><Plus className="ml-2 h-4 w-4" />הוסף רכב</Button>}
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי מספר רישוי, יצרן או דגם..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="ml-2 h-4 w-4" />
            <SelectValue placeholder="סינון לפי סטטוס" />
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
        <LoadingSpinner className="py-12" />
      ) : filteredVehicles && filteredVehicles.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              onClick={() => openEditDialog(vehicle)}
              className="card-hover cursor-pointer rounded-2xl bg-card p-6 shadow-lg"
            >
              {/* Vehicle Image or Placeholder */}
              <div className="mb-4 aspect-video overflow-hidden rounded-xl bg-muted">
                {vehicle.image_url ? (
                  <img
                    src={vehicle.image_url}
                    alt={`${vehicle.manufacturer} ${vehicle.model}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Car className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              {/* Vehicle Info */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold">
                      {vehicle.manufacturer} {vehicle.model}
                    </h3>
                    <p className="text-muted-foreground">{vehicle.license_plate}</p>
                  </div>
                  <StatusBadge status={vehicle.status} />
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                {vehicle.fuel_type && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Fuel className="h-4 w-4" />
                    <span>{vehicle.fuel_type}</span>
                  </div>
                )}
                {vehicle.current_km !== null && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Gauge className="h-4 w-4" />
                    <span>{formatNumber(vehicle.current_km)} ק״מ</span>
                  </div>
                )}
              </div>

              {/* Rates */}
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span>
                    יומי: {formatCurrency(vehicle.daily_rate || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Car className="h-8 w-8 text-muted-foreground" />}
          title="אין רכבים"
          description="לא נמצאו רכבים. הוסף רכב חדש כדי להתחיל."
          action={
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף רכב
            </Button>
          }
        />
      )}

      {/* Add/Edit Vehicle Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? "עריכת רכב" : "הוספת רכב חדש"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">פרטים בסיסיים</TabsTrigger>
                <TabsTrigger value="rates">תעריפים</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="license_plate">מספר רישוי *</Label>
                    <Input
                      id="license_plate"
                      name="license_plate"
                      defaultValue={editingVehicle?.license_plate}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">סטטוס</Label>
                    <Select name="status" defaultValue={editingVehicle?.status || "זמין"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">יצרן *</Label>
                    <Input
                      id="manufacturer"
                      name="manufacturer"
                      defaultValue={editingVehicle?.manufacturer}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">דגם *</Label>
                    <Input
                      id="model"
                      name="model"
                      defaultValue={editingVehicle?.model}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">שנת ייצור</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      defaultValue={editingVehicle?.year || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">צבע</Label>
                    <Input
                      id="color"
                      name="color"
                      defaultValue={editingVehicle?.color || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_type">סוג רכב</Label>
                    <Select name="vehicle_type" defaultValue={editingVehicle?.vehicle_type || undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel_type">סוג דלק</Label>
                    <Select name="fuel_type" defaultValue={editingVehicle?.fuel_type || undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג דלק" />
                      </SelectTrigger>
                      <SelectContent>
                        {fuelTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_km">ק״מ נוכחי</Label>
                    <Input
                      id="current_km"
                      name="current_km"
                      type="number"
                      defaultValue={editingVehicle?.current_km || 0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">הערות</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingVehicle?.notes || ""}
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="rates" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="daily_rate">תעריף יומי (₪)</Label>
                    <Input
                      id="daily_rate"
                      name="daily_rate"
                      type="number"
                      defaultValue={editingVehicle?.daily_rate || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="half_day_rate">תעריף חצי יום (₪)</Label>
                    <Input
                      id="half_day_rate"
                      name="half_day_rate"
                      type="number"
                      defaultValue={editingVehicle?.half_day_rate || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_rate">תעריף חודשי (₪)</Label>
                    <Input
                      id="monthly_rate"
                      name="monthly_rate"
                      type="number"
                      defaultValue={editingVehicle?.monthly_rate || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="km_limit">הגבלת ק״מ</Label>
                    <Input
                      id="km_limit"
                      name="km_limit"
                      type="number"
                      defaultValue={editingVehicle?.km_limit || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extra_km_price">מחיר ק״מ נוסף (₪)</Label>
                    <Input
                      id="extra_km_price"
                      name="extra_km_price"
                      type="number"
                      step="0.1"
                      defaultValue={editingVehicle?.extra_km_price || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hourly_delay_rate">תעריף שעתי לאיחור (₪)</Label>
                    <Input
                      id="hourly_delay_rate"
                      name="hourly_delay_rate"
                      type="number"
                      defaultValue={editingVehicle?.hourly_delay_rate || undefined}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                ביטול
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <LoadingSpinner size="sm" />
                ) : editingVehicle ? (
                  "עדכן"
                ) : (
                  "הוסף"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
