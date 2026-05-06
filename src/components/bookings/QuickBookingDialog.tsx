import React, { useState } from "react";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckCircle2, Check, ChevronsUpDown, Wrench } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

interface QuickBookingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (bookingData: BookingData) => void;
  onSubmitAndStart?: (bookingData: BookingData) => void;
  onMaintenanceClick?: () => void;
  date: string;
  vehicle: Vehicle | null;
  customers: Customer[];
  defaultStartTime?: string;
}

interface BookingData {
  customer_id: string | null;
  customer_name: string;
  vehicle_id: string;
  vehicle_details: string;
  start_date: string;
  start_time: string | null;
  end_date: string;
  end_time: string | null;
  rental_type: string;
  rental_cost: number;
  status: string;
  billing_rate_type?: string | null;
  billing_rate_amount?: number | null;
  collection_date_type?: string | null;
  collection_date?: string | null;
  collection_frequency?: string | null;
  future_payment_method?: string | null;
}

export default function QuickBookingDialog({ 
  isOpen, 
  onClose, 
  onSubmit,
  onSubmitAndStart,
  onMaintenanceClick,
  date, 
  vehicle,
  customers,
  defaultStartTime = "10:00"
}: QuickBookingDialogProps) {
  const [customerType, setCustomerType] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [rentalType, setRentalType] = useState("24 שעות");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customEndTime, setCustomEndTime] = useState("10:00");
  const [rentalCost, setRentalCost] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [billingRateType, setBillingRateType] = useState("");
  const [billingRateAmount, setBillingRateAmount] = useState("");
  const [collectionDateType, setCollectionDateType] = useState("תחילת השכרה");
  const [collectionDate, setCollectionDate] = useState("");
  const [collectionFrequency, setCollectionFrequency] = useState("");
  const [futurePaymentMethod, setFuturePaymentMethod] = useState("");

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const searchLower = customerSearch.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(searchLower)
    );
  });

  // Auto-calculate end date and time when rental type or start time changes
  const calculateEndDate = () => {
    if (!date) return "";
    const startDate = new Date(date);
    
    switch(rentalType) {
      case "חצי יום":
        return format(startDate, "yyyy-MM-dd");
      case "24 שעות":
        return format(addDays(startDate, 1), "yyyy-MM-dd");
      case "יומיים":
        return format(addDays(startDate, 2), "yyyy-MM-dd");
      case "שישי-שבת":
        return format(addDays(startDate, 2), "yyyy-MM-dd");
      case "שבוע":
        return format(addWeeks(startDate, 1), "yyyy-MM-dd");
      case "חודש":
        return format(addMonths(startDate, 1), "yyyy-MM-dd");
      case "עד תאריך":
        return customEndDate;
      default:
        return format(addDays(startDate, 1), "yyyy-MM-dd");
    }
  };

  const calculateDefaultEndTime = (type: string, start: string) => {
    if (type === "חצי יום") {
      // Half day: start + ~6 hours, cap at end of day
      const h = parseInt(start.split(":")[0]) || 10;
      const endH = Math.min(h + 6, 23);
      return `${String(endH).padStart(2, "0")}:00`;
    }
    // For all other types, return time = start time
    return start;
  };

  // Update end time automatically when rental type or start time changes
  React.useEffect(() => {
    if (rentalType !== "עד תאריך") {
      setCustomEndTime(calculateDefaultEndTime(rentalType, startTime));
    }
  }, [rentalType, startTime]);

  // Sync startTime when defaultStartTime prop changes
  React.useEffect(() => {
    setStartTime(defaultStartTime);
  }, [defaultStartTime]);

  const getBookingData = (): BookingData => {
    const selectedCustomer = customerType === "existing" 
      ? customers.find(c => c.id === customerId)
      : null;

    // Always use customEndTime (which is auto-calculated but editable)
    const endTime = customEndTime;

    return {
      customer_id: customerId || null,
      customer_name: customerType === "existing" 
        ? (selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : "")
        : newCustomerName,
      vehicle_id: vehicle?.id || "",
      vehicle_details: vehicle ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}` : "",
      start_date: date,
      start_time: startTime || null,
      end_date: calculateEndDate(),
      end_time: endTime || null,
      rental_type: rentalType === "עד תאריך" ? null : rentalType as any,
      rental_cost: rentalCost ? parseFloat(rentalCost) : 0,
      status: "מאושר",
      billing_rate_type: billingRateType || null,
      billing_rate_amount: billingRateAmount ? parseFloat(billingRateAmount) : null,
      collection_date_type: collectionDateType || null,
      collection_date: collectionDateType === "תאריך מסוים" ? (collectionDate || null) : null,
      collection_frequency: collectionFrequency || null,
      future_payment_method: futurePaymentMethod || null,
    };
  };

  const handleSubmit = () => {
    onSubmit(getBookingData());
    resetForm();
  };

  const handleSubmitAndStart = () => {
    if (onSubmitAndStart) {
      onSubmitAndStart(getBookingData());
      resetForm();
    }
  };

  const resetForm = () => {
    setCustomerType("existing");
    setCustomerId("");
    setNewCustomerName("");
    setStartTime("10:00");
    setRentalType("24 שעות");
    setCustomEndDate("");
    setCustomEndTime("10:00");
    setRentalCost("");
    setCustomerSearch("");
    setBillingRateType("");
    setBillingRateAmount("");
    setCollectionDateType("תחילת השכרה");
    setCollectionDate("");
    setCollectionFrequency("");
    setFuturePaymentMethod("");
  };

  const isFormValid = () => {
    if (customerType === "existing" && !customerId) return false;
    if (customerType === "new" && !newCustomerName) return false;
    if (rentalType === "עד תאריך" && !customEndDate) return false;
    return true;
  };

  if (!date || !vehicle) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>שריון מהיר - {vehicle.license_plate}</DialogTitle>
          <DialogDescription>
            יצירת הזמנה מהירה לרכב {vehicle.manufacturer} {vehicle.model}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div><strong>רכב:</strong> {vehicle.manufacturer} {vehicle.model}</div>
            <div><strong>תאריך:</strong> {format(new Date(date), "dd/MM/yyyy")}</div>
          </div>

          <div>
            <Label>סוג לקוח</Label>
            <Select value={customerType} onValueChange={(v) => setCustomerType(v as "existing" | "new")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">לקוח קיים</SelectItem>
                <SelectItem value="new">לקוח חדש</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customerType === "existing" ? (
            <div>
              <Label>בחר לקוח *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {customerId
                      ? (() => {
                          const selected = customers.find(c => c.id === customerId);
                          return selected ? `${selected.first_name} ${selected.last_name} - ${selected.phone}` : "בחר לקוח";
                        })()
                      : "בחר לקוח..."}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="חיפוש לפי שם או טלפון..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-60 overflow-y-auto">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">לא נמצאו לקוחות</div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted rounded text-sm"
                            onClick={() => {
                              setCustomerId(c.id);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={`h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div>
                              {c.first_name} {c.last_name} - {c.phone}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div>
              <Label>שם הלקוח *</Label>
              <Input
                placeholder="שם מלא"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>שעת יציאה</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <Label>סוג השכרה</Label>
            <Select value={rentalType} onValueChange={setRentalType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="חצי יום">חצי יום</SelectItem>
                <SelectItem value="24 שעות">24 שעות</SelectItem>
                <SelectItem value="יומיים">יומיים</SelectItem>
                <SelectItem value="שישי-שבת">שישי-שבת</SelectItem>
                <SelectItem value="שבוע">שבוע</SelectItem>
                <SelectItem value="חודש">חודש</SelectItem>
                <SelectItem value="עד תאריך">עד תאריך מסוים</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rentalType === "עד תאריך" && (
            <div>
              <Label>תאריך סיום</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={date}
              />
            </div>
          )}

          {rentalType !== "עד תאריך" && (
            <div className="text-sm text-muted-foreground bg-accent/10 p-3 rounded">
              תאריך סיום משוער: {calculateEndDate() ? format(new Date(calculateEndDate()), "dd/MM/yyyy") : "-"}
            </div>
          )}

          <div>
            <Label>שעת החזרה</Label>
            <Input
              type="time"
              value={customEndTime}
              onChange={(e) => setCustomEndTime(e.target.value)}
            />
          </div>

          <div>
            <Label>מחיר</Label>
            <Input
              type="number"
              placeholder="0"
              value={rentalCost}
              onChange={(e) => setRentalCost(e.target.value)}
            />
          </div>

          {/* Billing Rate Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>סוג תעריף לחיוב</Label>
              <Select value={billingRateType} onValueChange={(v) => {
                setBillingRateType(v);
                if (vehicle) {
                  const rateMap: Record<string, number | null> = {
                    "יומי": vehicle.daily_rate,
                    "שבועי": (vehicle as any).weekly_rate,
                    "חודשי": vehicle.monthly_rate,
                  };
                  if (rateMap[v]) setBillingRateAmount(String(rateMap[v]));
                }
              }}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="יומי">יומי</SelectItem>
                  <SelectItem value="שבועי">שבועי</SelectItem>
                  <SelectItem value="חודשי">חודשי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תעריף (₪)</Label>
              <Input
                type="number"
                value={billingRateAmount}
                onChange={(e) => setBillingRateAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Collection Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>מועד גביה</Label>
              <Select value={collectionDateType} onValueChange={setCollectionDateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="תחילת השכרה">תחילת השכרה</SelectItem>
                  <SelectItem value="סוף השכרה">סוף השכרה</SelectItem>
                  <SelectItem value="חלק בהתחלה חלק בסוף">חלק בהתחלה/סוף</SelectItem>
                  <SelectItem value="תאריך מסוים">תאריך מסוים</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {collectionDateType === "תאריך מסוים" && (
              <div>
                <Label>תאריך גביה</Label>
                <Input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Collection Frequency & Payment Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>תדירות גביה</Label>
              <Select value={collectionFrequency} onValueChange={setCollectionFrequency}>
                <SelectTrigger><SelectValue placeholder="חד פעמי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="חד פעמי">חד פעמי</SelectItem>
                  <SelectItem value="שבועי">שבועי</SelectItem>
                  <SelectItem value="חודשי">חודשי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>אופן תשלום עתידי</Label>
              <Select value={futurePaymentMethod} onValueChange={setFuturePaymentMethod}>
                <SelectTrigger><SelectValue placeholder="לא ידוע" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="אשראי">אשראי</SelectItem>
                  <SelectItem value="מזומן">מזומן</SelectItem>
                  <SelectItem value="העברה בנקאית">העברה</SelectItem>
                  <SelectItem value="ביט">ביט</SelectItem>
                  <SelectItem value="לא ידוע">לא ידוע</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {customerId && (
            <div className="rounded-lg border bg-cyan-50/50 p-3 space-y-2">
              <Label className="text-xs font-medium">סליקה דרך SUMIT</Label>
              <div className="flex flex-wrap gap-2">
                <PaymentButton
                  defaultAction="authorize"
                  label="תפיסת מסגרת J5"
                  amount={parseFloat(rentalCost) || 0}
                  description="תפיסת מסגרת אשראי"
                  customer={(() => {
                    const c = customers.find(x => x.id === customerId);
                    return c ? {
                      id: c.id, name: `${c.first_name} ${c.last_name}`,
                      phone: c.phone, email: c.email || undefined,
                      address: c.address || undefined, city: c.city || undefined,
                      citizenId: c.id_number,
                      payment_token: (c as any).payment_token,
                      card_last4: (c as any).card_last4,
                    } : undefined;
                  })()}
                />
                <PaymentButton
                  defaultAction="charge"
                  label="חיוב מקדמה"
                  amount={parseFloat(rentalCost) || 0}
                  description="מקדמה להשכרה"
                  customer={(() => {
                    const c = customers.find(x => x.id === customerId);
                    return c ? {
                      id: c.id, name: `${c.first_name} ${c.last_name}`,
                      phone: c.phone, email: c.email || undefined,
                      address: c.address || undefined, city: c.city || undefined,
                      citizenId: c.id_number,
                      payment_token: (c as any).payment_token,
                      card_last4: (c as any).card_last4,
                    } : undefined;
                  })()}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid()}
                variant="outline"
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 ml-2" />
                שמור הזמנה בלבד
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                ביטול
              </Button>
            </div>
            {onSubmitAndStart && (
              <Button
                onClick={handleSubmitAndStart}
                disabled={!isFormValid()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 ml-2" />
                שמור והמשך להפעלת השכרה
              </Button>
            )}
            {onMaintenanceClick && (
              <Button
                type="button"
                variant="outline"
                className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={() => {
                  onClose();
                  onMaintenanceClick();
                }}
              >
                <Wrench className="w-4 h-4 ml-2" />
                שריון לטיפול
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
