import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Eye, DollarSign, Clock, FileText } from "lucide-react";
import { formatShortDate, formatCurrency, formatTime, formatNumber } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Rental = Database["public"]["Tables"]["rentals"]["Row"];

export default function Rentals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const queryClient = useQueryClient();

  const { data: rentals, isLoading } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateRental = useMutation({
    mutationFn: async (update: Partial<Rental> & { id: string }) => {
      const { data, error } = await supabase
        .from("rentals")
        .update(update)
        .eq("id", update.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast({ title: "ההשכרה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון ההשכרה", description: error.message, variant: "destructive" });
    },
  });

  const filteredRentals = rentals?.filter((rental) => {
    const matchesSearch =
      rental.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.vehicle_details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || rental.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="היסטוריית השכרות"
        subtitle="צפייה וניהול כל ההשכרות במערכת"
      />

      <div className="bg-white rounded-2xl border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="חיפוש לפי לקוח, רכב או מספר חשבונית..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="פעיל">פעיל</SelectItem>
                <SelectItem value="הושלם">הושלם</SelectItem>
                <SelectItem value="בוטל">בוטל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : filteredRentals && filteredRentals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>חשבונית</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>רכב</TableHead>
                  <TableHead>תאריך התחלה</TableHead>
                  <TableHead>תאריך סיום</TableHead>
                  <TableHead>ק"מ</TableHead>
                  <TableHead>סה"כ</TableHead>
                  <TableHead>נותר</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell className="font-mono text-sm">{rental.invoice_number || "-"}</TableCell>
                    <TableCell className="font-medium">{rental.customer_name}</TableCell>
                    <TableCell>{rental.vehicle_details}</TableCell>
                    <TableCell>{formatShortDate(rental.start_date)}</TableCell>
                    <TableCell>
                      {rental.actual_end_date
                        ? formatShortDate(rental.actual_end_date)
                        : rental.planned_end_date
                        ? formatShortDate(rental.planned_end_date)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {rental.start_km && rental.end_km
                        ? `${formatNumber(rental.start_km)} → ${formatNumber(rental.end_km)}`
                        : rental.start_km
                        ? formatNumber(rental.start_km)
                        : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(rental.total_cost || 0)}</TableCell>
                    <TableCell className={rental.remaining_payment && rental.remaining_payment > 0 ? "text-destructive font-medium" : ""}>
                      {rental.remaining_payment && rental.remaining_payment > 0 ? formatCurrency(rental.remaining_payment) : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={rental.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRental(rental)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="אין השכרות" description="לא נמצאו השכרות במערכת" />
          )}
        </div>
      </div>

      {/* Rental Details Dialog */}
      <Dialog open={!!selectedRental} onOpenChange={(open) => !open && setSelectedRental(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>פרטי השכרה {selectedRental?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedRental && (
            <RentalDetails
              rental={selectedRental}
              onUpdate={(update) => updateRental.mutate({ ...update, id: selectedRental.id })}
              isLoading={updateRental.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RentalDetailsProps {
  rental: Rental;
  onUpdate: (update: Partial<Rental>) => void;
  isLoading: boolean;
}

function RentalDetails({ rental, onUpdate, isLoading }: RentalDetailsProps) {
  const [paymentAmount, setPaymentAmount] = useState("");

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "נא להזין סכום תקין", variant: "destructive" });
      return;
    }
    const newPaid = (rental.paid_amount || 0) + amount;
    const newRemaining = (rental.total_cost || 0) - newPaid;
    onUpdate({
      paid_amount: newPaid,
      remaining_payment: newRemaining >= 0 ? newRemaining : 0,
    });
    setPaymentAmount("");
  };

  return (
    <Tabs defaultValue="details" className="space-y-4">
      <TabsList>
        <TabsTrigger value="details" className="gap-2">
          <FileText className="h-4 w-4" />
          פרטים
        </TabsTrigger>
        <TabsTrigger value="payments" className="gap-2">
          <DollarSign className="h-4 w-4" />
          תשלומים
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">לקוח</h4>
            <p className="text-lg font-medium">{rental.customer_name}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">רכב</h4>
            <p className="text-lg font-medium">{rental.vehicle_details}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">תאריך התחלה</h4>
            <p className="text-lg font-medium">
              {formatShortDate(rental.start_date)} {rental.start_time && formatTime(rental.start_time)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">תאריך סיום</h4>
            <p className="text-lg font-medium">
              {rental.actual_end_date
                ? `${formatShortDate(rental.actual_end_date)} ${rental.actual_end_time ? formatTime(rental.actual_end_time) : ""}`
                : rental.planned_end_date
                ? `${formatShortDate(rental.planned_end_date)} (משוער)`
                : "-"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">ק"מ התחלה</h4>
            <p className="text-lg font-medium">{rental.start_km ? formatNumber(rental.start_km) : "-"}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">ק"מ סיום</h4>
            <p className="text-lg font-medium">{rental.end_km ? formatNumber(rental.end_km) : "-"}</p>
          </div>
          {rental.extra_km && rental.extra_km > 0 && (
            <>
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium text-muted-foreground">ק"מ נוסף</h4>
                <p className="text-lg font-medium">{formatNumber(rental.extra_km)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium text-muted-foreground">עלות ק"מ נוסף</h4>
                <p className="text-lg font-medium">{formatCurrency(rental.extra_km_cost || 0)}</p>
              </div>
            </>
          )}
        </div>

        {rental.notes && (
          <div className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">הערות</h4>
            <p>{rental.notes}</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="payments" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">עלות בסיס</h4>
            <p className="text-2xl font-bold">{formatCurrency(rental.base_cost || 0)}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">חיובים נוספים</h4>
            <p className="text-2xl font-bold">{formatCurrency(rental.additional_charges || 0)}</p>
            {rental.additional_charges_details && (
              <p className="mt-1 text-sm text-muted-foreground">{rental.additional_charges_details}</p>
            )}
          </div>
          <div className="rounded-lg border bg-primary/10 p-4">
            <h4 className="mb-2 font-medium text-muted-foreground">סה"כ לתשלום</h4>
            <p className="text-2xl font-bold">{formatCurrency(rental.total_cost || 0)}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-green-50 p-4">
            <h4 className="mb-2 font-medium text-green-700">שולם</h4>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(rental.paid_amount || 0)}</p>
          </div>
          <div className={`rounded-lg border p-4 ${rental.remaining_payment && rental.remaining_payment > 0 ? "bg-red-50" : "bg-green-50"}`}>
            <h4 className={`mb-2 font-medium ${rental.remaining_payment && rental.remaining_payment > 0 ? "text-red-700" : "text-green-700"}`}>
              נותר לתשלום
            </h4>
            <p className={`text-2xl font-bold ${rental.remaining_payment && rental.remaining_payment > 0 ? "text-red-700" : "text-green-700"}`}>
              {formatCurrency(rental.remaining_payment || 0)}
            </p>
          </div>
        </div>

        {rental.status === "פעיל" && rental.remaining_payment && rental.remaining_payment > 0 && (
          <div className="rounded-lg border p-4">
            <h4 className="mb-4 font-medium">הוספת תשלום</h4>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="סכום"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleAddPayment} disabled={isLoading}>
                <DollarSign className="ml-2 h-4 w-4" />
                הוסף תשלום
              </Button>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
