import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, User, Car, ArrowRight, Banknote } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import { PaymentButton } from "@/components/payments/PaymentButton";
import type { Tables } from "@/integrations/supabase/types";

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693ff630f364c7fbf1f677cd/fe961bf61_myname.jpg";

type Rental = Tables<"rentals">;
type Customer = Tables<"customers">;
type Vehicle = Tables<"vehicles">;

export default function TodayReturns() {
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [endRentalOpen, setEndRentalOpen] = useState(false);
  const [endRentalData, setEndRentalData] = useState({
    actual_end_date: format(new Date(), "yyyy-MM-dd"),
    actual_end_time: format(new Date(), "HH:mm"),
    end_km: 0,
    additional_charges: 0,
    additional_charges_details: "",
    // שאלון החזרה
    drove_toll: false,
    toll_amount: 0,
    had_damage: false,
    damage_amount: 0,
    damage_desc: "",
    full_fuel: true,
    fuel_amount: 0,
    // תשלום
    paid_now: 0,
    payment_method: "מזומן" as string,
  });
  const [returnStep, setReturnStep] = useState<"km" | "toll" | "damage" | "fuel" | "pay">("km");
  const [tollSides, setTollSides] = useState(0); // מספר צדדים בכבישי אגרה (₪50 לצד)
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<{ name: string; amount: number; method: string; vehicle: string; period: string; rentalId: string } | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals-today-returns", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .eq("planned_end_date", today)
        .eq("status", "פעיל");
      if (error) throw error;
      return data as Rental[];
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

  const handleReturnClick = (rental: Rental) => {
    const vehicle = vehicles.find((v) => v.id === rental.vehicle_id);
    setSelectedRental(rental);
    setEndRentalData({
      actual_end_date: format(new Date(), "yyyy-MM-dd"),
      actual_end_time: format(new Date(), "HH:mm"),
      end_km: vehicle?.current_km || 0,
      additional_charges: 0,
      additional_charges_details: "",
      drove_toll: false,
      toll_amount: 0,
      had_damage: false,
      damage_amount: 0,
      damage_desc: "",
      full_fuel: true,
      fuel_amount: 0,
      paid_now: 0,
      payment_method: "מזומן",
    });
    setTollSides(0);
    setReturnStep("km");
    setCashAmount("");
    setEndRentalOpen(true);
  };

  const confirmReturnCash = () => {
    const amt = Number(cashAmount) || 0;
    if (amt <= 0) { toast({ title: "נא להזין סכום", variant: "destructive" }); return; }
    setEndRentalData((p) => ({ ...p, paid_now: Number(p.paid_now || 0) + amt, payment_method: "מזומן" }));
    setCashDialogOpen(false);
    setCashAmount("");
    toast({ title: "התקבל תשלום מזומן", description: `₪${amt.toLocaleString()} — נא לוודא שהונח בקופה` });
  };

  const handleEndRental = async () => {
    if (!selectedRental) return;

    try {
      const vehicle = vehicles.find((v) => v.id === selectedRental.vehicle_id);
      const kmDiff = endRentalData.end_km - (selectedRental.start_km || 0);
      const kmLimit = vehicle?.km_limit || 0;
      const extraKm = Math.max(0, kmDiff - kmLimit);
      const extraKmCost = extraKm * (vehicle?.extra_km_price || 0);

      // חיובי שאלון ההחזרה
      const tollCharge = tollSides * 50;
      const damageCharge = endRentalData.had_damage ? Number(endRentalData.damage_amount || 0) : 0;
      const fuelCharge = !endRentalData.full_fuel ? Number(endRentalData.fuel_amount || 0) : 0;
      const questionnaireCharges = tollCharge + damageCharge + fuelCharge;

      const detailsParts: string[] = [];
      if (endRentalData.additional_charges_details) detailsParts.push(endRentalData.additional_charges_details);
      if (tollCharge) detailsParts.push(`כבישי אגרה: ₪${tollCharge}`);
      if (damageCharge) detailsParts.push(`נזק: ₪${damageCharge}${endRentalData.damage_desc ? ` (${endRentalData.damage_desc})` : ""}`);
      if (fuelCharge) detailsParts.push(`דלק חסר: ₪${fuelCharge}`);
      const mergedDetails = detailsParts.join(" | ");

      const additionalTotal = (endRentalData.additional_charges || 0) + questionnaireCharges;

      const totalCost =
        (selectedRental.base_cost || 0) +
        extraKmCost +
        additionalTotal;
      const paidTotal = (selectedRental.paid_amount || 0) + Number(endRentalData.paid_now || 0);
      const remainingPayment = Math.max(0, totalCost - paidTotal);

      // Update rental
      const { error: rentalError } = await supabase
        .from("rentals")
        .update({
          actual_end_date: endRentalData.actual_end_date,
          actual_end_time: endRentalData.actual_end_time,
          end_km: endRentalData.end_km,
          extra_km: extraKm,
          extra_km_cost: extraKmCost,
          additional_charges: additionalTotal,
          additional_charges_details: mergedDetails || null,
          toll_charges: tollCharge,
          total_cost: totalCost,
          paid_amount: paidTotal,
          remaining_payment: remainingPayment,
          status: "הושלם",
        } as any)
        .eq("id", selectedRental.id);

      if (rentalError) throw rentalError;

      // רישום הכנסה אם שולם עכשיו
      if (Number(endRentalData.paid_now || 0) > 0) {
        await supabase.from("incomes").insert({
          customer_id: selectedRental.customer_id,
          customer_name: selectedRental.customer_name,
          rental_id: selectedRental.id,
          vehicle_id: selectedRental.vehicle_id,
          amount: Number(endRentalData.paid_now),
          date: endRentalData.actual_end_date,
          type: "השכרה",
          payment_method: endRentalData.payment_method || null,
          notes: "תשלום בהחזרת רכב (תחנה)",
        } as any);
      }

      // Update vehicle
      const { error: vehicleError } = await supabase
        .from("vehicles")
        .update({
          status: "זמין",
          current_km: endRentalData.end_km,
        })
        .eq("id", selectedRental.vehicle_id);

      if (vehicleError) throw vehicleError;

      // Update booking
      if (selectedRental.booking_id) {
        await supabase
          .from("bookings")
          .update({ status: "הושלם" })
          .eq("id", selectedRental.booking_id);
      }

      // Create collection task if remaining payment
      if (remainingPayment > 0) {
        await supabase.from("collection_tasks").insert({
          customer_id: selectedRental.customer_id,
          customer_name: selectedRental.customer_name,
          rental_id: selectedRental.id,
          vehicle_id: selectedRental.vehicle_id,
          vehicle_details: selectedRental.vehicle_details,
          debt_date: endRentalData.actual_end_date,
          amount: remainingPayment,
          reason: "יתרת תשלום סיום השכרה",
          status: "פתוח",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["collection_tasks"] });

      toast({ title: "ההשכרה הסתיימה בהצלחה!" });
      setEndRentalOpen(false);
      // פתיחת חשבונית אוטומטית בסיום
      setInvoiceData({
        name: selectedRental.customer_name || "",
        amount: totalCost,
        method: endRentalData.payment_method,
        vehicle: selectedRental.vehicle_details || "",
        period: `${selectedRental.start_date || ""} - ${endRentalData.actual_end_date}`,
        rentalId: selectedRental.id,
      });
      setInvoiceOpen(true);
      setSelectedRental(null);
    } catch (error) {
      console.error(error);
      toast({ title: "שגיאה בסיום ההשכרה", variant: "destructive" });
    }
  };

  // חישוב הסה"כ הכולל לתצוגה (כולל חיובי שאלון ההחזרה)
  const returnVehicle = vehicles.find((v) => v.id === selectedRental?.vehicle_id);
  const returnTotalCost = (() => {
    if (!selectedRental) return 0;
    const kmDiff = endRentalData.end_km - (selectedRental.start_km || 0);
    const extraKm = Math.max(0, kmDiff - (returnVehicle?.km_limit || 0));
    const extraKmCost = extraKm * (returnVehicle?.extra_km_price || 0);
    const toll = tollSides * 50;
    const damage = endRentalData.had_damage ? Number(endRentalData.damage_amount || 0) : 0;
    const fuel = !endRentalData.full_fuel ? Number(endRentalData.fuel_amount || 0) : 0;
    return (selectedRental.base_cost || 0) + extraKmCost + (endRentalData.additional_charges || 0) + toll + damage + fuel;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/rental-station")}
            className="shadow-lg hover:shadow-xl transition-all"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            חזרה לתפריט ראשי
          </Button>

          <div className="flex justify-center">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center p-2">
              <img
                src={LOGO_URL}
                alt="Autopo Logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="w-32"></div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3 text-blue-600">
            החזרות רכבים
          </h1>

          <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
            <Calendar className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: he })}
            </h2>
          </div>
          <p className="text-gray-600 text-lg">לחץ על כרטיס לסיום השכרה</p>
        </div>

        {rentals.length === 0 ? (
          <Card className="p-12 text-center bg-white">
            <div className="text-gray-400 mb-4">
              <Car className="w-16 h-16 mx-auto" />
            </div>
            <p className="text-xl text-gray-600">אין החזרות מתוכננות להיום</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rentals.map((rental) => {
              const customer = customers.find(
                (c) => c.id === rental.customer_id
              );
              const vehicle = vehicles.find((v) => v.id === rental.vehicle_id);

              return (
                <Card
                  key={rental.id}
                  className="p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white border-2 border-transparent hover:border-blue-400"
                  onClick={() => handleReturnClick(rental)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {rental.customer_name}
                        </h3>
                        {customer?.phone && (
                          <p className="text-sm text-gray-500">
                            {customer.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Car className="w-5 h-5 text-gray-400 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {vehicle?.manufacturer} {vehicle?.model}
                        </p>
                        <p className="text-sm text-gray-500">
                          {vehicle?.license_plate}
                        </p>
                      </div>
                    </div>

                    {rental.planned_end_time && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">
                          שעת החזרה: {rental.planned_end_time}
                        </span>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">
                          ק"מ יציאה:
                        </span>
                        <span className="text-sm font-medium">
                          {rental.start_km?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          נותר לתשלום:
                        </span>
                        <span className="text-xl font-bold text-blue-600">
                          ₪{rental.remaining_payment?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>

                    <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                      סיום השכרה
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* End Rental Dialog */}
      <Dialog open={endRentalOpen} onOpenChange={setEndRentalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>סיום השכרה</DialogTitle>
          </DialogHeader>
          {selectedRental && (
            <div className="space-y-4">
              <Card className="p-3 bg-gray-50 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">לקוח:</span><span className="font-medium">{selectedRental.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">רכב:</span><span className="font-medium">{selectedRental.vehicle_details}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">ק"מ התחלה:</span><span className="font-medium">{selectedRental.start_km?.toLocaleString()}</span></div>
              </Card>

              {/* שלב 1: קילומטראז' */}
              {returnStep === "km" && (
                <div className="space-y-4">
                  <div>
                    <Label>ק"מ בהחזרה *</Label>
                    <Input type="number" value={endRentalData.end_km} onChange={(e) => setEndRentalData({ ...endRentalData, end_km: parseInt(e.target.value) || 0 })} autoFocus />
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => setReturnStep("toll")}>המשך</Button>
                </div>
              )}

              {/* שלב 2: כבישי אגרה */}
              {returnStep === "toll" && (
                <div className="space-y-4">
                  <p className="font-semibold text-center">נסעת בכביש 6 / כבישי אגרה?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant={!endRentalData.drove_toll ? "default" : "outline"} onClick={() => { setEndRentalData({ ...endRentalData, drove_toll: false }); setTollSides(0); }}>לא</Button>
                    <Button variant={endRentalData.drove_toll ? "default" : "outline"} onClick={() => { setEndRentalData({ ...endRentalData, drove_toll: true }); if (tollSides === 0) setTollSides(1); }}>כן</Button>
                  </div>
                  {endRentalData.drove_toll && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <Label className="text-sm">כמה צדדים? (₪50 לכל צד)</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map((n) => (
                          <Button key={n} size="sm" variant={tollSides === n ? "default" : "outline"} onClick={() => setTollSides(n)}>{n}</Button>
                        ))}
                        <Input type="number" className="w-20" value={tollSides} onChange={(e) => setTollSides(parseInt(e.target.value) || 0)} />
                      </div>
                      <p className="text-sm font-medium text-orange-600">חיוב אגרה: ₪{(tollSides * 50).toLocaleString()}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setReturnStep("km")}>הקודם</Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setReturnStep("damage")}>המשך</Button>
                  </div>
                </div>
              )}

              {/* שלב 3: נזק */}
              {returnStep === "damage" && (
                <div className="space-y-4">
                  <p className="font-semibold text-center">האם נגרם נזק לרכב?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant={!endRentalData.had_damage ? "default" : "outline"} onClick={() => setEndRentalData({ ...endRentalData, had_damage: false, damage_amount: 0, damage_desc: "" })}>לא</Button>
                    <Button variant={endRentalData.had_damage ? "default" : "outline"} onClick={() => setEndRentalData({ ...endRentalData, had_damage: true })}>כן</Button>
                  </div>
                  {endRentalData.had_damage && (
                    <div className="p-3 border rounded-lg space-y-2">
                      <Input type="number" placeholder="סכום חיוב על הנזק (₪)" value={endRentalData.damage_amount || ""} onChange={(e) => setEndRentalData({ ...endRentalData, damage_amount: parseFloat(e.target.value) || 0 })} />
                      <Textarea placeholder="פירוט הנזק (חובה)" value={endRentalData.damage_desc} onChange={(e) => setEndRentalData({ ...endRentalData, damage_desc: e.target.value })} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setReturnStep("toll")}>הקודם</Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={endRentalData.had_damage && !endRentalData.damage_desc.trim()} onClick={() => setReturnStep("fuel")}>המשך</Button>
                  </div>
                </div>
              )}

              {/* שלב 4: דלק */}
              {returnStep === "fuel" && (
                <div className="space-y-4">
                  <p className="font-semibold text-center">האם הרכב הוחזר עם דלק מלא?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant={endRentalData.full_fuel ? "default" : "outline"} onClick={() => setEndRentalData({ ...endRentalData, full_fuel: true, fuel_amount: 0 })}>כן, מלא</Button>
                    <Button variant={!endRentalData.full_fuel ? "default" : "outline"} onClick={() => setEndRentalData({ ...endRentalData, full_fuel: false })}>לא</Button>
                  </div>
                  {!endRentalData.full_fuel && (
                    <div className="p-3 border rounded-lg">
                      <Label className="text-sm">סכום חיוב על דלק חסר (₪)</Label>
                      <Input type="number" value={endRentalData.fuel_amount || ""} onChange={(e) => setEndRentalData({ ...endRentalData, fuel_amount: parseFloat(e.target.value) || 0 })} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setReturnStep("damage")}>הקודם</Button>
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!endRentalData.full_fuel && !endRentalData.fuel_amount} onClick={() => setReturnStep("pay")}>המשך לתשלום</Button>
                  </div>
                </div>
              )}

              {/* שלב 5: תשלום + חשבונית */}
              {returnStep === "pay" && (() => {
                const cust = customers.find((c) => c.id === selectedRental.customer_id);
                const remaining = Math.max(0, returnTotalCost - (selectedRental.paid_amount || 0) - Number(endRentalData.paid_now || 0));
                return (
                  <div className="space-y-4">
                    <Card className="p-4 bg-blue-50">
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span>סה"כ:</span><span className="font-semibold">₪{returnTotalCost.toLocaleString()}</span></div>
                        <div className="flex justify-between text-green-700"><span>שולם:</span><span>₪{((selectedRental.paid_amount || 0) + Number(endRentalData.paid_now || 0)).toLocaleString()}</span></div>
                        <div className="flex justify-between font-bold text-red-600 border-t pt-1"><span>נותר לתשלום:</span><span>₪{remaining.toLocaleString()}</span></div>
                      </div>
                    </Card>

                    <p className="text-sm font-semibold text-center">תשלום היתרה</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-auto py-4 flex-col gap-1" onClick={() => { setCashAmount(String(remaining)); setCashDialogOpen(true); }}>
                        <Banknote className="w-6 h-6 text-green-600" />תשלום במזומן
                      </Button>
                      <PaymentButton
                        defaultAction="charge"
                        label="תשלום באשראי"
                        amount={remaining}
                        description={`החזרת רכב - ${selectedRental.vehicle_details || ""}`}
                        variant="outline"
                        className="w-full h-auto py-4"
                        rentalId={selectedRental.id}
                        customer={cust ? { id: cust.id, name: `${cust.first_name} ${cust.last_name}`, phone: cust.phone, email: cust.email || undefined, citizenId: cust.id_number, payment_token: (cust as any).payment_token, card_last4: (cust as any).card_last4, card_expiry: (cust as any).card_expiry } : { name: selectedRental.customer_name || "" }}
                        onSuccess={(r: any) => {
                          if (r?.action === "charge" && r?.success) {
                            const charged = Number(r?.amount || 0);
                            if (charged > 0) setEndRentalData((prev) => ({ ...prev, paid_now: Number(prev.paid_now || 0) + charged, payment_method: "אשראי" }));
                          }
                        }}
                      />
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" onClick={() => setReturnStep("fuel")}>הקודם</Button>
                      <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleEndRental}>
                        סיום והפקת חשבונית
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* חלונית תשלום מזומן בהחזרה */}
      <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>תשלום במזומן</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
              יש להניח את הכסף בקופה המיועדת ולאשר את הסכום שהונח.
            </div>
            <div>
              <Label>סכום שהונח בקופה (₪)</Label>
              <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} autoFocus />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmReturnCash} className="flex-1 bg-green-600 hover:bg-green-700">אישור — הונח בקופה</Button>
              <Button variant="outline" onClick={() => setCashDialogOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* חשבונית אוטומטית בסיום ההחזרה */}
      <InvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        rentalId={invoiceData?.rentalId}
        defaultCustomerName={invoiceData?.name}
        defaultAmount={invoiceData?.amount}
        defaultPaymentMethod={invoiceData?.method}
        defaultVehicleDetails={invoiceData?.vehicle}
        defaultPeriod={invoiceData?.period}
      />
    </div>
  );
}
