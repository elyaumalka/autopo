import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
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
import { Search, Car, User, Calendar, Check, XCircle, Eye, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";
import RentalDetailsDialog from "@/components/rentals/RentalDetailsDialog";
import type { Tables } from "@/integrations/supabase/types";

type Rental = Tables<"rentals">;
type Vehicle = Tables<"vehicles">;

export default function Rentals() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [endRentalDialog, setEndRentalDialog] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [viewingRental, setViewingRental] = useState<Rental | null>(null);
  const [endData, setEndData] = useState({
    actual_end_date: "",
    actual_end_time: "",
    end_km: 0,
    additional_charges: 0,
    additional_charges_details: "",
  });

  const { data: rentals = [], isLoading } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Rental[];
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rentals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: "ההשכרה נמחקה בהצלחה" });
    },
    onError: () => {
      toast({ title: "שגיאה במחיקת השכרה", variant: "destructive" });
    },
  });

  const openEndDialog = (rental: Rental) => {
    setSelectedRental(rental);
    const vehicle = vehicles.find((v) => v.id === rental.vehicle_id);
    setEndData({
      actual_end_date: format(new Date(), "yyyy-MM-dd"),
      actual_end_time: format(new Date(), "HH:mm"),
      end_km: vehicle?.current_km || rental.start_km || 0,
      additional_charges: 0,
      additional_charges_details: "",
    });
    setEndRentalDialog(true);
  };

  const calculateCosts = () => {
    if (!selectedRental) return { extraKm: 0, extraKmCost: 0, totalCost: 0, remaining: 0 };

    const vehicle = vehicles.find((v) => v.id === selectedRental.vehicle_id);
    const extraKm = Math.max(
      0,
      (endData.end_km || 0) - (selectedRental.start_km || 0) - (vehicle?.km_limit || 0)
    );
    const extraKmCost = extraKm * (vehicle?.extra_km_price || 0);
    const additionalCharges = endData.additional_charges || 0;
    const totalCost = (selectedRental.base_cost || 0) + extraKmCost + additionalCharges;
    const remaining = totalCost - (selectedRental.paid_amount || 0);

    return { extraKm, extraKmCost, totalCost, remaining };
  };

  const handleEndRental = async () => {
    if (!selectedRental) return;

    const costs = calculateCosts();
    const vehicle = vehicles.find((v) => v.id === selectedRental.vehicle_id);

    try {
      // Update rental
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          actual_end_date: endData.actual_end_date,
          actual_end_time: endData.actual_end_time,
          end_km: endData.end_km,
          extra_km: costs.extraKm,
          extra_km_cost: costs.extraKmCost,
          additional_charges: endData.additional_charges,
          additional_charges_details: endData.additional_charges_details,
          total_cost: costs.totalCost,
          remaining_payment: costs.remaining,
          status: "הושלם",
        })
        .eq("id", selectedRental.id);

      if (rentalError) throw rentalError;

      // Update booking status
      if (selectedRental.booking_id) {
        await supabase
          .from("bookings")
          .update({ status: "הושלם" })
          .eq("id", selectedRental.booking_id);
      }

      // Update vehicle
      if (vehicle) {
        await supabase
          .from("vehicles")
          .update({
            status: "זמין",
            current_km: endData.end_km,
          })
          .eq("id", vehicle.id);
      }

      // Create income record
      await supabase.from("incomes").insert({
        customer_id: selectedRental.customer_id,
        customer_name: selectedRental.customer_name,
        rental_id: selectedRental.id,
        vehicle_id: selectedRental.vehicle_id,
        amount: costs.totalCost,
        date: endData.actual_end_date,
        type: "השכרה",
      });

      // Create collection task if remaining payment
      if (costs.remaining > 0) {
        await supabase.from("collection_tasks").insert({
          customer_id: selectedRental.customer_id,
          customer_name: selectedRental.customer_name,
          rental_id: selectedRental.id,
          vehicle_id: selectedRental.vehicle_id,
          vehicle_details: selectedRental.vehicle_details,
          debt_date: endData.actual_end_date,
          amount: costs.remaining,
          reason: "יתרת תשלום השכרה",
          status: "פתוח",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });

      toast({ title: "ההשכרה הסתיימה בהצלחה" });
      setEndRentalDialog(false);
      setSelectedRental(null);
    } catch (error) {
      toast({ title: "שגיאה בסיום השכרה", variant: "destructive" });
    }
  };

  const filteredRentals = rentals.filter((r) => {
    const matchesSearch =
      r.customer_name?.includes(searchTerm) || r.vehicle_details?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeRentals = rentals.filter((r) => r.status === "פעיל");

  const columns = [
    {
      header: "לקוח",
      cell: (row: Rental) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{row.customer_name}</span>
        </div>
      ),
    },
    {
      header: "רכב",
      cell: (row: Rental) => (
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-muted-foreground" />
          <span>{row.vehicle_details}</span>
        </div>
      ),
    },
    {
      header: "תאריך התחלה",
      cell: (row: Rental) =>
        row.start_date ? format(new Date(row.start_date), "dd/MM/yy") : "-",
    },
    {
      header: "תאריך סיום",
      cell: (row: Rental) =>
        row.planned_end_date ? format(new Date(row.planned_end_date), "dd/MM/yy") : "-",
    },
    {
      header: "תשלום",
      cell: (row: Rental) => (
        <div className="text-sm">
          <div className="font-medium">
            ₪{row.total_cost?.toLocaleString() || row.base_cost?.toLocaleString() || 0}
          </div>
          <div className="text-green-600">שולם: ₪{row.paid_amount?.toLocaleString() || 0}</div>
          <div className="text-red-600">נותר: ₪{row.remaining_payment?.toLocaleString() || 0}</div>
        </div>
      ),
    },
    {
      header: "סטטוס",
      cell: (row: Rental) => <StatusBadge status={row.status || "פעיל"} />,
    },
    {
      header: "פעולות",
      cell: (row: Rental) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setViewingRental(row)}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === "פעיל" && (
            <Button
              size="sm"
              className="bg-red-500 hover:bg-red-600"
              onClick={() => openEndDialog(row)}
            >
              <XCircle className="w-4 h-4 ml-1" />
              סיום
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("האם למחוק השכרה זו לגמרי?")) {
                deleteMutation.mutate(row.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="השכרות" subtitle={`${activeRentals.length} השכרות פעילות`} />

      {/* Active Rentals Summary */}
      {activeRentals.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeRentals.slice(0, 3).map((rental, i) => {
            const daysLeft = rental.planned_end_date
              ? differenceInDays(new Date(rental.planned_end_date), new Date())
              : 0;

            return (
              <motion.div
                key={rental.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`p-4 border-r-4 ${
                    daysLeft <= 1 ? "border-r-red-500 bg-red-50" : "border-r-cyan-500"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{rental.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{rental.vehicle_details}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openEndDialog(rental)}>
                      סיום
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        עד{" "}
                        {rental.planned_end_date
                          ? format(new Date(rental.planned_end_date), "dd/MM")
                          : "-"}
                      </span>
                    </div>
                    <div
                      className={`font-medium ${
                        daysLeft <= 1 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {daysLeft > 0 ? `${daysLeft} ימים` : daysLeft === 0 ? "היום" : "באיחור!"}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="חיפוש..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="פעיל">פעיל</SelectItem>
            <SelectItem value="הושלם">הושלם</SelectItem>
            <SelectItem value="בוטל">בוטל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filteredRentals}
        isLoading={isLoading}
        emptyMessage="לא נמצאו השכרות"
      />

      {/* Rental Details Dialog */}
      <RentalDetailsDialog
        rental={viewingRental}
        isOpen={!!viewingRental}
        onClose={() => setViewingRental(null)}
      />

      {/* End Rental Dialog */}
      <Dialog open={endRentalDialog} onOpenChange={setEndRentalDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>סיום השכרה</DialogTitle>
          </DialogHeader>

          {selectedRental && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedRental.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedRental.vehicle_details}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>תאריך סיום</Label>
                  <Input
                    type="date"
                    value={endData.actual_end_date}
                    onChange={(e) =>
                      setEndData({ ...endData, actual_end_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>שעת סיום</Label>
                  <Input
                    type="time"
                    value={endData.actual_end_time}
                    onChange={(e) =>
                      setEndData({ ...endData, actual_end_time: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>ק"מ סיום</Label>
                  <Input
                    type="number"
                    value={endData.end_km}
                    onChange={(e) =>
                      setEndData({ ...endData, end_km: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <Label>חיובים נוספים</Label>
                  <Input
                    type="number"
                    value={endData.additional_charges}
                    onChange={(e) =>
                      setEndData({
                        ...endData,
                        additional_charges: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>פירוט חיובים נוספים</Label>
                <Textarea
                  placeholder="כביש 6, דלק, וכד'"
                  value={endData.additional_charges_details}
                  onChange={(e) =>
                    setEndData({ ...endData, additional_charges_details: e.target.value })
                  }
                />
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-cyan-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>עלות בסיס:</span>
                  <span>₪{selectedRental.base_cost?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>ק"מ נוסף ({calculateCosts().extraKm} ק"מ):</span>
                  <span>₪{calculateCosts().extraKmCost?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>חיובים נוספים:</span>
                  <span>₪{(endData.additional_charges || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>סה"כ:</span>
                  <span>₪{calculateCosts().totalCost?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>שולם:</span>
                  <span>₪{selectedRental.paid_amount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600">
                  <span>נותר לתשלום:</span>
                  <span>₪{calculateCosts().remaining?.toLocaleString() || 0}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleEndRental}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                >
                  <Check className="w-4 h-4 ml-2" />
                  סיום והוצאת חשבונית
                </Button>
                <Button variant="outline" onClick={() => setEndRentalDialog(false)}>
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
