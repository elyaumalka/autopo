import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { format, addDays, isAfter, parseISO } from "date-fns";
import { calculateRentalCost, getRateForType, getDailyRateFromBilling } from "@/lib/rentalCalculations";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Car, User, Search, CheckCircle, ArrowLeft, Eye, FileText, CalendarDays, Plus, Trash2, XCircle, Wrench, Edit, Calendar as CalendarIcon, Receipt } from "lucide-react";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import BookingsCalendarView from "@/components/bookings/BookingsCalendarView";
import QuickBookingDialog from "@/components/bookings/QuickBookingDialog";
import RentalStartWizard from "@/components/bookings/RentalStartWizard";
import EndRentalDialog from "@/components/bookings/EndRentalDialog";
import { toast } from "@/hooks/use-toast";
import { CustomerNameInput } from "@/components/shared/CustomerNameInput";
import { useUndo } from "@/contexts/UndoContext";
import DocumentsList from "@/components/shared/DocumentsList";
import type { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Rental = Database["public"]["Tables"]["rentals"]["Row"];
type MaintenanceTask = Database["public"]["Tables"]["maintenance_tasks"]["Row"];

export default function Bookings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Booking>>({});
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [activeTab, setActiveTab] = useState("calendar");
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [quickBookingData, setQuickBookingData] = useState<{ date: string; vehicle: Vehicle; defaultStartTime?: string } | null>(null);
  const [rentalWizardOpen, setRentalWizardOpen] = useState(false);
  const [wizardBooking, setWizardBooking] = useState<Booking | null>(null);
  const [showVehicleSwap, setShowVehicleSwap] = useState(false);
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<Booking | null>(null);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);
  const [endDialogBooking, setEndDialogBooking] = useState<Booking | null>(null);
  const [endDialogRental, setEndDialogRental] = useState<Rental | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [maintenanceData, setMaintenanceData] = useState({
    type: "טיפול תקופתי" as string,
    due_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    description: "",
    notes: "",
    activate_now: false,
  });
  const [calendarActionBooking, setCalendarActionBooking] = useState<Booking | null>(null);
  const [calendarActionRental, setCalendarActionRental] = useState<Rental | null>(null);
  const [calendarActionOpen, setCalendarActionOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendData, setExtendData] = useState({ new_end_date: "", new_end_time: "", new_cost: "", daily_rate: "", added_cost: "" });
  const [maintenanceActionTask, setMaintenanceActionTask] = useState<MaintenanceTask | null>(null);
  const [maintenanceActionOpen, setMaintenanceActionOpen] = useState(false);
  const [maintenanceEditOpen, setMaintenanceEditOpen] = useState(false);
  const [maintenanceEditData, setMaintenanceEditData] = useState({ type: "", description: "", notes: "", end_date: "" });
  const [docsViewerOpen, setDocsViewerOpen] = useState(false);
  const [docsViewerBookingId, setDocsViewerBookingId] = useState<string | null>(null);
  const [docsViewerCustomerName, setDocsViewerCustomerName] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("status", "פעיל");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .not("status", "eq", "נמכר");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: maintenanceTasks = [] } = useQuery({
    queryKey: ["maintenance_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*")
        .neq("status", "הושלם");
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && bookings.length > 0) {
      const booking = bookings.find(b => b.id === editId);
      if (booking) {
        setViewingBooking(booking);
        setSearchParams({}, { replace: true });
      }
    }
  }, [bookings, searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Booking>) => {
      const { data: result, error } = await supabase
        .from("bookings")
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "ההזמנה נוצרה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה ביצירת הזמנה", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Booking> }) => {
      const { error } = await supabase
        .from("bookings")
        .update(data as any)
        .eq("id", id);
      if (error) throw error;

      // Sync with linked rental if exists
      const linkedRental = rentals.find(r => r.booking_id === id);
      if (linkedRental) {
        const rentalUpdate: any = {};
        if (data.customer_name !== undefined) rentalUpdate.customer_name = data.customer_name;
        if (data.vehicle_details !== undefined) rentalUpdate.vehicle_details = data.vehicle_details;
        if (data.customer_id !== undefined) rentalUpdate.customer_id = data.customer_id;
        if (data.vehicle_id !== undefined) rentalUpdate.vehicle_id = data.vehicle_id;
        if (data.start_date !== undefined) rentalUpdate.start_date = data.start_date;
        if (data.start_time !== undefined) rentalUpdate.start_time = data.start_time;
        if (data.end_date !== undefined) {
          rentalUpdate.planned_end_date = data.end_date;
          // אם ההשכרה כבר הושלמה - סנכרן גם את תאריך הסיום בפועל כדי שהתצוגה בלוח תתעדכן
          if (linkedRental.status === "הושלם") {
            rentalUpdate.actual_end_date = data.end_date;
          }
        }
        if (data.end_time !== undefined) {
          rentalUpdate.planned_end_time = data.end_time;
          if (linkedRental.status === "הושלם") {
            rentalUpdate.actual_end_time = data.end_time;
          }
        }
        if (data.rental_cost !== undefined) rentalUpdate.base_cost = data.rental_cost;

        if (Object.keys(rentalUpdate).length > 0) {
          await supabase.from("rentals").update(rentalUpdate).eq("id", linkedRental.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-all"] });
      setIsOpen(false);
      resetForm();
      toast({ title: "ההזמנה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון הזמנה", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (booking: Booking) => {
      const linkedRental = rentals.find(r => r.booking_id === booking.id);
      if (linkedRental) {
        if (linkedRental.vehicle_id && linkedRental.status === "פעיל") {
          await supabase.from("vehicles").update({ status: "זמין" }).eq("id", linkedRental.vehicle_id);
        }
        const { error: rentalError } = await supabase.from("rentals").delete().eq("id", linkedRental.id);
        if (rentalError) throw rentalError;
      }

      if (booking.vehicle_id && booking.status === "פעיל") {
        await supabase.from("vehicles").update({ status: "זמין" }).eq("id", booking.vehicle_id);
      }

      const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
      if (error) throw error;

      // החזרת הנתונים שנמחקו לצורך ביטול פעולה (Ctrl+Z)
      return { deletedBooking: booking, deletedRental: linkedRental ?? null };
    },
    // עדכון אופטימי - השורה נעלמת מיד מהטבלה בלי להמתין לשרת/ריענון
    onMutate: async (booking: Booking) => {
      setDeleteConfirmBooking(null);
      setCalendarActionOpen(false);
      await queryClient.cancelQueries({ queryKey: ["bookings"] });
      const previousBookings = queryClient.getQueryData<Booking[]>(["bookings"]);
      queryClient.setQueryData<Booking[]>(["bookings"], (old) =>
        (old ?? []).filter((b) => b.id !== booking.id)
      );
      return { previousBookings };
    },
    onError: (error, _booking, context) => {
      // החזרת המצב הקודם אם המחיקה נכשלה בשרת
      if (context?.previousBookings) {
        queryClient.setQueryData(["bookings"], context.previousBookings);
      }
      toast({ title: "שגיאה במחיקת הזמנה", description: error.message, variant: "destructive" });
    },
    onSuccess: (data) => {
      // רישום פעולת ביטול: שחזור ההזמנה (וההשכרה המקושרת) שנמחקו
      const deletedBooking = (data as any)?.deletedBooking as Booking | undefined;
      const deletedRental = (data as any)?.deletedRental as Rental | null | undefined;
      if (deletedBooking) {
        registerUndo("מחיקת הזמנה", async () => {
          await supabase.from("bookings").insert(deletedBooking as any);
          if (deletedRental) {
            await supabase.from("rentals").insert(deletedRental as any);
            if (deletedRental.vehicle_id && deletedRental.status === "פעיל") {
              await supabase.from("vehicles").update({ status: "מושכר" }).eq("id", deletedRental.vehicle_id);
            }
          }
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          queryClient.invalidateQueries({ queryKey: ["rentals"] });
          queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        });
      } else {
        toast({ title: "ההזמנה נמחקה בהצלחה" });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  });

  const openEndRentalDialog = (booking: Booking, rentalOverride?: Rental | null) => {
    const linkedRental = rentalOverride ?? rentals.find((r) => r.booking_id === booking.id) ?? null;
    setEndDialogBooking(booking);
    setEndDialogRental(linkedRental);
    setEndDialogOpen(true);
    setCalendarActionOpen(false);
  };

  // Extend rental mutation
  const extendMutation = useMutation({
    mutationFn: async ({ booking, rental, newEndDate, newEndTime, newCost }: { booking: Booking; rental: Rental | null; newEndDate: string; newEndTime: string; newCost?: number }) => {
      const bookingUpdate: any = { end_date: newEndDate, end_time: newEndTime || null };
      if (newCost !== undefined) bookingUpdate.rental_cost = newCost;
      const { error: bookingError } = await supabase
        .from("bookings")
        .update(bookingUpdate)
        .eq("id", booking.id);
      if (bookingError) throw bookingError;

      if (rental) {
        const rentalUpdate: any = { planned_end_date: newEndDate, planned_end_time: newEndTime || null };
        if (newCost !== undefined) rentalUpdate.base_cost = newCost;
        const { error: rentalError } = await supabase
          .from("rentals")
          .update(rentalUpdate)
          .eq("id", rental.id);
        if (rentalError) throw rentalError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
      setExtendDialogOpen(false);
      setCalendarActionOpen(false);
      toast({ title: "ההזמנה הוארכה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בהארכת הזמנה", description: error.message, variant: "destructive" });
    }
  });

  const maintenanceMutation = useMutation({
    mutationFn: async () => {
      if (!maintenanceVehicle) throw new Error("לא נבחר רכב");
      if (!maintenanceData.due_date) throw new Error("יש לבחור תאריך התחלה");

      const startDate = parseISO(maintenanceData.due_date);
      const endDate = parseISO(maintenanceData.end_date || maintenanceData.due_date);

      if (isAfter(startDate, endDate)) {
        throw new Error("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
      }

      const dates: string[] = [];
      let cursor = startDate;
      while (!isAfter(cursor, endDate)) {
        dates.push(format(cursor, "yyyy-MM-dd"));
        cursor = addDays(cursor, 1);
      }

      const vehicle = maintenanceVehicle;
      // שעות שריון רלוונטיות רק לשריון של יום בודד (חצי יום / טווח שעות)
      const isSingleDay = dates.length === 1;
      const rows = dates.map((date) => ({
        vehicle_id: vehicle.id,
        vehicle_details: `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`,
        type: maintenanceData.type as any,
        due_date: date,
        start_time: isSingleDay ? (maintenanceData.start_time || null) : null,
        end_time: isSingleDay ? (maintenanceData.end_time || null) : null,
        description: maintenanceData.description || null,
        notes: maintenanceData.notes || null,
        status: maintenanceData.activate_now ? "בתהליך" as any : "ממתין" as any,
      }));

      const { error } = await supabase.from("maintenance_tasks").insert(rows as any);
      if (error) throw error;

      if (maintenanceData.activate_now) {
        await supabase.from("vehicles").update({ status: "בטיפול" }).eq("id", vehicle.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setMaintenanceDialogOpen(false);
      setMaintenanceVehicle(null);
      setMaintenanceData({ type: "טיפול תקופתי", due_date: "", end_date: "", start_time: "", end_time: "", description: "", notes: "", activate_now: false });
      toast({ title: "שריון טיפול נשמר בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה ביצירת משימה", description: error.message, variant: "destructive" });
    }
  });

  // Maintenance update mutation
  const maintenanceUpdateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MaintenanceTask> }) => {
      const { error } = await supabase.from("maintenance_tasks").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setMaintenanceActionOpen(false);
      setMaintenanceEditOpen(false);
      setMaintenanceActionTask(null);
      toast({ title: "המשימה עודכנה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה בעדכון המשימה", description: error.message, variant: "destructive" });
    }
  });

  // Maintenance delete mutation
  const maintenanceDeleteMutation = useMutation({
    mutationFn: async (task: MaintenanceTask) => {
      // Delete all tasks for same vehicle with same type+description in the date range
      const { error } = await supabase.from("maintenance_tasks").delete().eq("id", task.id);
      if (error) throw error;
      // Release vehicle if it was in maintenance
      if (task.status === "בתהליך") {
        // Check if there are other active maintenance tasks for this vehicle
        const { data: remaining } = await supabase
          .from("maintenance_tasks")
          .select("id")
          .eq("vehicle_id", task.vehicle_id)
          .eq("status", "בתהליך")
          .neq("id", task.id);
        if (!remaining || remaining.length === 0) {
          await supabase.from("vehicles").update({ status: "זמין" }).eq("id", task.vehicle_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setMaintenanceActionOpen(false);
      setMaintenanceActionTask(null);
      toast({ title: "המשימה נמחקה בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה במחיקת המשימה", description: error.message, variant: "destructive" });
    }
  });

  // Complete maintenance task
  const handleCompleteMaintenance = async (task: MaintenanceTask) => {
    await maintenanceUpdateMutation.mutateAsync({
      id: task.id,
      data: { status: "הושלם" as any, completed_date: format(new Date(), "yyyy-MM-dd") }
    });
    // Check if there are other active maintenance tasks for this vehicle
    const { data: remaining } = await supabase
      .from("maintenance_tasks")
      .select("id")
      .eq("vehicle_id", task.vehicle_id)
      .eq("status", "בתהליך")
      .neq("id", task.id);
    if (!remaining || remaining.length === 0) {
      await supabase.from("vehicles").update({ status: "זמין" }).eq("id", task.vehicle_id);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  // Activate maintenance task
  const handleActivateMaintenance = async (task: MaintenanceTask) => {
    await maintenanceUpdateMutation.mutateAsync({
      id: task.id,
      data: { status: "בתהליך" as any }
    });
    await supabase.from("vehicles").update({ status: "בטיפול" }).eq("id", task.vehicle_id);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const handleOpenMaintenanceDialog = (vehicle: Vehicle, date?: string) => {
    const selectedDate = date || format(new Date(), "yyyy-MM-dd");
    setMaintenanceVehicle(vehicle);
    setMaintenanceData({
      type: "טיפול תקופתי",
      due_date: selectedDate,
      end_date: selectedDate,
      start_time: "",
      end_time: "",
      description: "",
      notes: "",
      activate_now: false,
    });
    setMaintenanceDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({});
    setStep(1);
    setSelectedBooking(null);
    setShowVehicleSwap(false);
  };

  const isVehicleAvailable = (vehicleId: string, startDate: string, endDate: string, excludeBookingId?: string) => {
    const hasOverlap = bookings.some(b => {
      if (b.id === excludeBookingId) return false;
      if (b.vehicle_id !== vehicleId) return false;
      if (b.status === "בוטל" || b.status === "הושלם") return false;
      return startDate < b.end_date && endDate > b.start_date;
    });
    return !hasOverlap;
  };

  const getAvailableVehicles = () => {
    if (!formData.start_date || !formData.end_date) return [];
    return vehicles.filter(v => 
      v.status !== "נמכר" && 
      v.status !== "לא פעיל" &&
      isVehicleAvailable(v.id, formData.start_date!, formData.end_date!, selectedBooking?.id)
    );
  };

  const handleSubmit = async () => {
    // חסימה: תאריך החזרה לא יכול להיות לפני תאריך הלקיחה
    if (formData.start_date && formData.end_date) {
      const startDT = parseISO(`${formData.start_date}T${formData.start_time || "00:00"}`);
      const endDT = parseISO(`${formData.end_date}T${formData.end_time || "00:00"}`);
      if (endDT < startDT) {
        toast({ title: "שגיאה בתאריכים", description: "תאריך/שעת ההחזרה לא יכולים להיות לפני תאריך/שעת הלקיחה", variant: "destructive" });
        return;
      }
    }

    const customer = customers.find(c => c.id === formData.customer_id);
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);

    const data: Partial<Booking> = {
      ...formData,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : (formData.customer_name || selectedBooking?.customer_name || ""),
      vehicle_details: vehicle ? `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}` : (formData.vehicle_details || selectedBooking?.vehicle_details || ""),
      rental_cost: formData.rental_cost ? Number(formData.rental_cost) : 0,
      deposit_amount: formData.deposit_amount ? Number(formData.deposit_amount) : 0,
      credit_hold: formData.credit_hold ? Number(formData.credit_hold) : 0,
      status: formData.status || "מאושר"
    };

    // לקוח חדש שהוקלד ידנית (שם ללא בחירה מהרשימה) - נשמר ככרטיס לקוח כדי שניתן יהיה להשלים פרטים
    await createCustomerIfNeeded(data);

    if (selectedBooking) {
      updateMutation.mutate({ id: selectedBooking.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCalendarCellClick = (date: Date, vehicle: Vehicle, booking?: any, slotInfo?: { slot: "am" | "pm"; existingEndTime?: string | null }) => {
    if (booking) {
      // Check if this is a maintenance task
      if (booking.status === "בטיפול") {
        const foundMaintenance = maintenanceTasks.find(m => m.id === booking.id);
        if (foundMaintenance) {
          setMaintenanceActionTask(foundMaintenance);
          setMaintenanceActionOpen(true);
          return;
        }
      }

      // Find the actual booking record
      let foundBooking: Booking | undefined;
      let foundRental: Rental | undefined;

      if (booking.type === "rental" || booking.status === "פעיל") {
        foundRental = rentals.find(r => r.id === booking.id);
        if (foundRental) {
          foundBooking = bookings.find(b => b.id === foundRental!.booking_id);
        }
        if (!foundBooking) {
          foundBooking = bookings.find(b => b.id === booking.id);
        }
      } else {
        foundBooking = booking.id 
          ? bookings.find(b => b.id === booking.id)
          : bookings.find(b => 
              b.vehicle_id === vehicle.id && 
              b.start_date <= format(date, "yyyy-MM-dd") && 
              b.end_date >= format(date, "yyyy-MM-dd") &&
              b.status !== "בוטל" && b.status !== "הושלם" &&
              b.customer_name === booking.customerName
            );
      }

      if (foundBooking) {
        setCalendarActionBooking(foundBooking);
        setCalendarActionRental(foundRental || rentals.find(r => r.booking_id === foundBooking!.id) || null);
        setCalendarActionOpen(true);
      }
    } else {
      let defaultStartTime = "09:00";
      if (slotInfo) {
        if (slotInfo.slot === "pm") {
          defaultStartTime = slotInfo.existingEndTime ? slotInfo.existingEndTime.slice(0, 5) : "16:00";
        } else {
          defaultStartTime = slotInfo.existingEndTime ? slotInfo.existingEndTime.slice(0, 5) : "09:00";
        }
      }
      setQuickBookingData({ date: format(date, "yyyy-MM-dd"), vehicle, defaultStartTime });
      setQuickBookingOpen(true);
    }
  };

  const createCustomerIfNeeded = async (bookingData: any) => {
    if (!bookingData.customer_id && bookingData.customer_name) {
      const nameParts = bookingData.customer_name.trim().split(/\s+/);
      const firstName = nameParts[0] || bookingData.customer_name;
      const lastName = nameParts.slice(1).join(" ") || "-";
      // ת.ז זמני וייחודי (העמודה UNIQUE) - הלקוח ישלים אותה אח"כ
      const tempIdNumber = `חדש-${Date.now()}${Math.floor(Math.random() * 1000)}`;

      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert({
          first_name: firstName,
          last_name: lastName,
          phone: "",
          id_number: tempIdNumber,
          notes: "לקוח חדש - יש להשלים פרטים",
        })
        .select()
        .single();
      
      if (error) {
        console.error("Error creating customer:", error);
        toast({ title: "שגיאה ביצירת לקוח", description: error.message, variant: "destructive" });
        return null;
      }
      
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      bookingData.customer_id = newCustomer.id;
      bookingData.customer_name = `${firstName} ${lastName}`;
      return newCustomer;
    }
    return null;
  };

  const handleQuickBookingSubmit = async (bookingData: any) => {
    if (!isVehicleAvailable(bookingData.vehicle_id, bookingData.start_date, bookingData.end_date)) {
      toast({ title: "הרכב תפוס", description: "הרכב כבר תפוס בתאריכים אלו.", variant: "destructive" });
      return;
    }
    
    await createCustomerIfNeeded(bookingData);
    await createMutation.mutateAsync(bookingData);
    setQuickBookingOpen(false);
    setQuickBookingData(null);
  };

  const handleQuickBookingSubmitAndStart = async (bookingData: any) => {
    if (!isVehicleAvailable(bookingData.vehicle_id, bookingData.start_date, bookingData.end_date)) {
      toast({ title: "הרכב תפוס", description: "הרכב כבר תפוס בתאריכים אלו.", variant: "destructive" });
      return;
    }
    
    await createCustomerIfNeeded(bookingData);
    const newBooking = await createMutation.mutateAsync(bookingData);
    setQuickBookingOpen(false);
    setQuickBookingData(null);
    
    setWizardBooking(newBooking);
    setRentalWizardOpen(true);
  };

  const handleWizardComplete = () => {
    setRentalWizardOpen(false);
    setWizardBooking(null);
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
    queryClient.invalidateQueries({ queryKey: ["bookings-week"] });
    queryClient.invalidateQueries({ queryKey: ["rentals"] });
    queryClient.invalidateQueries({ queryKey: ["rentals-active"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles-all"] });
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vehicle_details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditBooking = (row: Booking) => {
    setSelectedBooking(row);
    setFormData(row);
    setStep(1);
    setShowVehicleSwap(false);
    setIsOpen(true);
  };

  const columns = [
    {
      header: "פעולות",
      cell: (row: Booking) => (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewingBooking(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleEditBooking(row)}
          >
            עריכה
          </Button>
          {(row.status === "מאושר" || row.status === "ממתין") && (
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setWizardBooking(row);
                setRentalWizardOpen(true);
              }}
            >
              <CheckCircle className="w-4 h-4 ml-1" />
              התחל
            </Button>
          )}
          {row.status === "פעיל" && (
            <Button 
              size="sm" 
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={() => openEndRentalDialog(row)}
            >
              <XCircle className="w-4 h-4 ml-1" />
              סיים
            </Button>
          )}
          {(row.status === "פעיל" || row.status === "הושלם") && (
            <Button
              size="sm"
              variant="outline"
              className="text-cyan-700 border-cyan-300 hover:bg-cyan-50"
              onClick={() => setInvoiceBooking(row)}
              title="הפק חשבונית"
            >
              <Receipt className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteConfirmBooking(row)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    {
      header: "סטטוס",
      cell: (row: Booking) => {
        const displayStatus = row.status === "מאושר" ? "משוריין" : row.status;
        return <StatusBadge status={displayStatus || "ממתין"} />;
      }
    },
    {
      header: "תשלום",
      cell: (row: Booking) => {
        const total = row.rental_cost || 0;
        const paid = row.deposit_amount || 0;
        const remaining = total - paid;
        
        const linkedRental = rentals.find(r => r.booking_id === row.id);
        const hasInvoice = !!linkedRental?.invoice_number;

        return (
          <div className="text-sm">
            <div className="font-medium">₪{total.toLocaleString()}</div>
            {paid > 0 && (
              <div className="text-green-600 text-xs">שולם: ₪{paid.toLocaleString()}</div>
            )}
            {remaining > 0 && (
              <div className="text-red-600 text-xs">נותר: ₪{remaining.toLocaleString()}</div>
            )}
            {hasInvoice && (
              <div className="text-green-700 text-xs mt-0.5">✓ חשבונית</div>
            )}
          </div>
        );
      }
    },
    {
      header: "תאריך סיום",
      cell: (row: Booking) => (
        <div className="text-sm">
          {row.end_date ? format(new Date(row.end_date), "dd/MM/yy") : "-"}
          {row.end_time && ` ${row.end_time.substring(0, 5)}`}
        </div>
      )
    },
    {
      header: "תאריך התחלה",
      cell: (row: Booking) => (
        <div className="text-sm">
          {row.start_date ? format(new Date(row.start_date), "dd/MM/yy") : "-"}
          {row.start_time && ` ${row.start_time.substring(0, 5)}`}
        </div>
      )
    },
    {
      header: "רכב",
      cell: (row: Booking) => (
        <div className="flex items-center gap-2">
          <Car className="w-5 h-5 text-muted-foreground" />
          <span className="text-base font-bold tracking-wide">{row.vehicle_details}</span>
        </div>
      )
    },
    {
      header: "לקוח",
      cell: (row: Booking) => (
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-muted-foreground" />
          <span className="text-base font-bold">{row.customer_name}</span>
        </div>
      )
    }
  ];

  const currentEditVehicle = formData.vehicle_id ? vehicles.find(v => v.id === formData.vehicle_id) : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="הזמנות"
        subtitle={`${bookings.length} הזמנות`}
        action={
          <Button onClick={() => { resetForm(); setIsOpen(true); }}>
            <Plus className="ml-2 h-4 w-4" />
            הזמנה חדשה
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="calendar" className="gap-2 data-[state=active]:bg-muted">
            <CalendarDays className="h-4 w-4" />
            תמונת מצב
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-muted">
            <FileText className="h-4 w-4" />
            רשימת הזמנות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <BookingsCalendarView 
              onNewBooking={() => { resetForm(); setIsOpen(true); }}
              onCellClick={handleCalendarCellClick}
              onMaintenanceClick={(vehicle, date) => handleOpenMaintenanceDialog(vehicle, date)}
              maintenanceTasks={maintenanceTasks}
            />
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-6 mt-4">
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי לקוח או רכב..."
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
                  <SelectItem value="ממתין">ממתין</SelectItem>
                  <SelectItem value="מאושר">משוריין</SelectItem>
                  <SelectItem value="פעיל">פעיל</SelectItem>
                  <SelectItem value="הושלם">הושלם</SelectItem>
                  <SelectItem value="בוטל">בוטל</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DataTable
              columns={columns}
              data={filteredBookings}
              isLoading={isLoading}
              emptyMessage="לא נמצאו הזמנות"
              rowClassName={(row: Booking, i: number) => {
                const odd = i % 2 === 1;
                // צבע לפי סטטוס + גוון מתחלף בין שורה לשורה כדי להבדיל שורות סמוכות
                if (row.status === "בוטל") return "bg-red-50 opacity-60 line-through";
                if (row.status === "הושלם") return odd ? "bg-gray-200/80" : "bg-gray-100";
                if (row.status === "פעיל") return odd ? "bg-green-100" : "bg-green-50";
                if (row.status === "מאושר" || row.status === "ממתין") return odd ? "bg-yellow-100" : "bg-yellow-50";
                return odd ? "bg-muted/30" : "";
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Calendar Action Menu Dialog */}
      <Dialog open={calendarActionOpen} onOpenChange={(open) => { if (!open) { setCalendarActionOpen(false); setCalendarActionBooking(null); setCalendarActionRental(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(calendarActionRental?.status || calendarActionBooking?.status) === "פעיל"
                ? "השכרה פעילה"
                : (calendarActionRental?.status || calendarActionBooking?.status) === "הושלם"
                ? "השכרה שהושלמה"
                : "הזמנה משוריינת"}
            </DialogTitle>
          </DialogHeader>

          {calendarActionBooking && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">לקוח:</span>
                  <span className="font-medium">{calendarActionBooking.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">רכב:</span>
                  <span className="font-medium">{calendarActionBooking.vehicle_details}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תאריכים:</span>
                  <span className="font-medium">
                    {calendarActionBooking.start_date} {calendarActionBooking.start_time ? `(${calendarActionBooking.start_time.toString().slice(0,5)})` : ""}
                    {" → "}
                    {calendarActionBooking.end_date} {calendarActionBooking.end_time ? `(${calendarActionBooking.end_time.toString().slice(0,5)})` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סטטוס:</span>
                  <StatusBadge status={calendarActionRental?.status || calendarActionBooking.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {(calendarActionBooking.status === "מאושר" || calendarActionBooking.status === "ממתין") && (
                  <>
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        setWizardBooking(calendarActionBooking);
                        setRentalWizardOpen(true);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 ml-2" />
                      התחל השכרה
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        handleEditBooking(calendarActionBooking);
                      }}
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך הזמנה
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        setDeleteConfirmBooking(calendarActionBooking);
                      }}
                    >
                      <Trash2 className="w-4 h-4 ml-2" />
                      מחק הזמנה
                    </Button>
                  </>
                )}

                {(calendarActionRental?.status || calendarActionBooking.status) === "פעיל" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={() => {
                        const v = vehicles.find((x) => x.id === calendarActionBooking.vehicle_id);
                        // תעריף ההארכה לפי סוג התעריף של ההשכרה (חודשי/שבועי/יומי), לא לפי התעריף היומי של הרכב
                        const effectiveDaily = getDailyRateFromBilling(
                          calendarActionBooking.billing_rate_type,
                          calendarActionBooking.billing_rate_amount,
                          v?.daily_rate,
                        );
                        const dailyRate = effectiveDaily ? String(effectiveDaily) : "";
                        setExtendData({
                          new_end_date: calendarActionBooking.end_date,
                          new_end_time: calendarActionBooking.end_time?.toString().slice(0,5) || "",
                          new_cost: calendarActionBooking.rental_cost?.toString() || "",
                          daily_rate: dailyRate,
                          added_cost: "",
                        });
                        setExtendDialogOpen(true);
                      }}
                    >
                      <CalendarIcon className="w-4 h-4 ml-2" />
                      הארך השכרה
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                      onClick={() => openEndRentalDialog(calendarActionBooking, calendarActionRental)}
                    >
                      <XCircle className="w-4 h-4 ml-2" />
                      סיים השכרה
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        handleEditBooking(calendarActionBooking);
                      }}
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך פרטים
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        setDocsViewerBookingId(calendarActionBooking.id);
                        setDocsViewerCustomerName(calendarActionBooking.customer_name);
                        setDocsViewerOpen(true);
                      }}
                    >
                      <FileText className="w-4 h-4 ml-2" />
                      צפה במסמכים חתומים
                    </Button>
                    {(() => {
                      const c = customers.find(x => x.id === calendarActionBooking.customer_id);
                      if (!c) return null;
                      const customerProp = {
                        id: c.id,
                        name: `${c.first_name} ${c.last_name}`,
                        phone: c.phone,
                        email: c.email || undefined,
                        address: c.address || undefined,
                        city: c.city || undefined,
                        citizenId: c.id_number,
                        payment_token: (c as any).payment_token,
                        card_last4: (c as any).card_last4,
                        card_expiry: (c as any).card_expiry,
                      };
                      const amount = calendarActionBooking.rental_cost || 0;
                      return (
                        <div className="rounded-lg border bg-cyan-50/50 p-2 space-y-2">
                          <div className="text-xs font-medium text-center">סליקה דרך SUMIT</div>
                          <div className="grid grid-cols-2 gap-2">
                            <PaymentButton
                              defaultAction="authorize"
                              label="תפיסת מסגרת J5"
                              amount={amount}
                              description="תפיסת מסגרת אשראי"
                              customer={customerProp}
                            />
                            <PaymentButton
                              defaultAction="charge"
                              label="חיוב באשראי"
                              amount={amount}
                              description={`חיוב השכרה ${calendarActionBooking.id}`}
                              customer={customerProp}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {(calendarActionRental?.status || calendarActionBooking.status) === "הושלם" && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openEndRentalDialog(calendarActionBooking, calendarActionRental)}
                    >
                      חיוב יתרה / עדכון סיום
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        handleEditBooking(calendarActionBooking);
                      }}
                    >
                      <Edit className="w-4 h-4 ml-2" />
                      ערוך הזמנה
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCalendarActionOpen(false);
                        setDocsViewerBookingId(calendarActionBooking.id);
                        setDocsViewerCustomerName(calendarActionBooking.customer_name);
                        setDocsViewerOpen(true);
                      }}
                    >
                      <FileText className="w-4 h-4 ml-2" />
                      צפה במסמכים חתומים
                    </Button>
                  </>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    setCalendarActionOpen(false);
                    setDeleteConfirmBooking(calendarActionBooking);
                  }}
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  מחק
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extend Rental Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={(open) => { if (!open) setExtendDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הארכת השכרה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <div><strong>לקוח:</strong> {calendarActionBooking?.customer_name}</div>
              <div><strong>רכב:</strong> {calendarActionBooking?.vehicle_details}</div>
              <div><strong>תאריך סיום נוכחי:</strong> {calendarActionBooking?.end_date} {calendarActionBooking?.end_time?.toString().slice(0,5) || ""}</div>
            </div>
            <div>
              <Label>תאריך סיום חדש</Label>
              <Input
                type="date"
                value={extendData.new_end_date}
                min={calendarActionBooking?.end_date}
                onChange={(e) => {
                  const newEnd = e.target.value;
                  const origEnd = calendarActionBooking?.end_date;
                  const origCost = Number(calendarActionBooking?.rental_cost || 0);
                  const rate = Number(extendData.daily_rate || 0);
                  let added = 0;
                  if (newEnd && origEnd && rate) {
                    const days = Math.max(0, Math.ceil((new Date(newEnd).getTime() - new Date(origEnd).getTime()) / 86400000));
                    added = Math.round(days * rate * 100) / 100;
                  }
                  setExtendData({
                    ...extendData,
                    new_end_date: newEnd,
                    added_cost: added ? String(added) : "",
                    new_cost: rate ? String(Math.round((origCost + added) * 100) / 100) : extendData.new_cost,
                  });
                }}
              />
            </div>
            <div>
              <Label>שעת סיום חדשה</Label>
              <Input
                type="time"
                value={extendData.new_end_time}
                onChange={(e) => setExtendData({ ...extendData, new_end_time: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>תעריף יומי (₪)</Label>
                <Input
                  type="number"
                  value={extendData.daily_rate}
                  onChange={(e) => {
                    const rate = Number(e.target.value || 0);
                    const origEnd = calendarActionBooking?.end_date;
                    const origCost = Number(calendarActionBooking?.rental_cost || 0);
                    let added = 0;
                    if (extendData.new_end_date && origEnd && rate) {
                      const days = Math.max(0, Math.ceil((new Date(extendData.new_end_date).getTime() - new Date(origEnd).getTime()) / 86400000));
                      added = Math.round(days * rate * 100) / 100;
                    }
                    setExtendData({
                      ...extendData,
                      daily_rate: e.target.value,
                      added_cost: added ? String(added) : "",
                      new_cost: rate ? String(Math.round((origCost + added) * 100) / 100) : extendData.new_cost,
                    });
                  }}
                />
              </div>
              <div>
                <Label>תוספת לתשלום (₪)</Label>
                <Input
                  type="number"
                  value={extendData.added_cost}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
            </div>
            <div>
              <Label>מחיר כולל מעודכן (₪)</Label>
              <Input
                type="number"
                value={extendData.new_cost}
                onChange={(e) => setExtendData({ ...extendData, new_cost: e.target.value })}
                placeholder="ניתן לערוך ידנית"
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                disabled={!extendData.new_end_date || extendMutation.isPending}
                onClick={() => {
                  if (calendarActionBooking) {
                    extendMutation.mutate({
                      booking: calendarActionBooking,
                      rental: calendarActionRental,
                      newEndDate: extendData.new_end_date,
                      newEndTime: extendData.new_end_time,
                      newCost: extendData.new_cost ? Number(extendData.new_cost) : undefined,
                    });
                  }
                }}
              >
                {extendMutation.isPending ? "מעדכן..." : "עדכן"}
              </Button>
              <Button variant="outline" onClick={() => setExtendDialogOpen(false)}>ביטול</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Booking Dialog */}
      {quickBookingData && (
        <QuickBookingDialog
          isOpen={quickBookingOpen}
          onClose={() => {
            setQuickBookingOpen(false);
            setQuickBookingData(null);
          }}
          onSubmit={handleQuickBookingSubmit}
          onSubmitAndStart={handleQuickBookingSubmitAndStart}
          onMaintenanceClick={() => {
            if (quickBookingData?.vehicle) {
              handleOpenMaintenanceDialog(quickBookingData.vehicle, quickBookingData.date);
            }
          }}
          date={quickBookingData.date}
          vehicle={quickBookingData.vehicle}
          customers={customers}
          defaultStartTime={quickBookingData.defaultStartTime}
        />
      )}

      {/* Create/Edit Booking Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBooking ? "עריכת הזמנה" : "הזמנה חדשה"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Progress Steps */}
            {!selectedBooking ? (
              <div className="flex items-center justify-between mb-6">
                {["תאריכים", "רכב", "פרטים"].map((s, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${step > i + 1 ? 'bg-accent text-accent-foreground' : step === i + 1 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                      {i + 1}
                    </div>
                    <span className={`mr-2 text-sm ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
                    {i < 2 && <div className="w-12 h-0.5 bg-muted mx-2" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between mb-6">
                {["תאריכים ורכב", "פרטים"].map((s, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${step > i + 1 ? 'bg-accent text-accent-foreground' : step === i + 1 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}
                    `}>
                      {i + 1}
                    </div>
                    <span className={`mr-2 text-sm ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
                    {i < 1 && <div className="w-12 h-0.5 bg-muted mx-2" />}
                  </div>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>לקוח *</Label>
                  <CustomerNameInput
                    customers={customers}
                    customerId={formData.customer_id || ""}
                    customerName={formData.customer_id ? (() => { const c = customers.find(x => x.id === formData.customer_id); return c ? `${c.first_name} ${c.last_name}` : (formData.customer_name || ""); })() : (formData.customer_name || "")}
                    onChange={({ customerId, customerName }) => setFormData({ ...formData, customer_id: customerId, customer_name: customerId ? "" : customerName })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    הקלד שם לחיפוש ובחר מהרשימה, או הקלד שם חדש שיישמר אוטומטית כלקוח חדש (להשלמת פרטים).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>תאריך התחלה *</Label>
                    <Input
                      type="date"
                      value={formData.start_date || ""}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>שעת התחלה</Label>
                    <Input
                      type="time"
                      value={formData.start_time || ""}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>תאריך סיום *</Label>
                    <Input
                      type="date"
                      value={formData.end_date || ""}
                      min={formData.start_date || undefined}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>שעת סיום</Label>
                    <Input
                      type="time"
                      value={formData.end_time || ""}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    />
                  </div>
                </div>

                {/* Show current vehicle for edit mode */}
                {selectedBooking && currentEditVehicle && !showVehicleSwap && (
                  <div className="space-y-2">
                    <Label>רכב משויך</Label>
                    <Card className="p-4 border-2 border-accent bg-accent/10">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{currentEditVehicle.manufacturer} {currentEditVehicle.model}</p>
                          <p className="text-sm text-muted-foreground">{currentEditVehicle.license_plate} | {currentEditVehicle.vehicle_type}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-accent">₪{currentEditVehicle.daily_rate}/יום</p>
                        </div>
                      </div>
                    </Card>
                    <Button variant="outline" size="sm" onClick={() => setShowVehicleSwap(true)}>
                      <Car className="w-4 h-4 ml-2" />
                      החלפת רכב
                    </Button>
                  </div>
                )}

                {/* Vehicle swap inline for edit mode */}
                {selectedBooking && showVehicleSwap && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>בחר רכב חלופי</Label>
                      <Button variant="ghost" size="sm" onClick={() => setShowVehicleSwap(false)}>
                        ← חזרה לרכב הנוכחי
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {getAvailableVehicles().map(vehicle => (
                        <Card
                          key={vehicle.id}
                          className={`p-3 cursor-pointer transition-all ${
                            formData.vehicle_id === vehicle.id 
                              ? 'border-2 border-accent bg-accent/10' 
                              : 'hover:border-accent/50'
                          }`}
                          onClick={() => {
                            setFormData({ ...formData, vehicle_id: vehicle.id });
                            setShowVehicleSwap(false);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">{vehicle.manufacturer} {vehicle.model}</p>
                              <p className="text-xs text-muted-foreground">{vehicle.license_plate}</p>
                            </div>
                            <p className="font-bold text-accent text-sm">₪{vehicle.daily_rate}/יום</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {selectedBooking ? (
                    <>
                      <Button 
                        onClick={() => setStep(selectedBooking ? 3 : 2)}
                        disabled={(!formData.customer_id && !formData.customer_name) || !formData.start_date || !formData.end_date}
                        className="w-full"
                      >
                        המשך לפרטים
                        <ArrowLeft className="w-4 h-4 mr-2" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSubmit}
                        disabled={updateMutation.isPending}
                        className="w-full"
                      >
                        עדכון הזמנה
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={() => setStep(2)}
                      disabled={!formData.customer_id || !formData.start_date || !formData.end_date}
                      className="w-full"
                    >
                      המשך
                      <ArrowLeft className="w-4 h-4 mr-2" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {step === 2 && !selectedBooking && (
              <div className="space-y-4">
                <h3 className="font-semibold">רכבים זמינים בתאריכים הנבחרים</h3>
                {getAvailableVehicles().length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    אין רכבים זמינים בתאריכים אלו
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                    {getAvailableVehicles().map(vehicle => (
                      <Card
                        key={vehicle.id}
                        className={`p-4 cursor-pointer transition-all ${
                          formData.vehicle_id === vehicle.id 
                            ? 'border-2 border-accent bg-accent/10' 
                            : 'hover:border-accent/50'
                        }`}
                        onClick={() => setFormData({ ...formData, vehicle_id: vehicle.id })}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{vehicle.manufacturer} {vehicle.model}</p>
                            <p className="text-sm text-muted-foreground">{vehicle.license_plate} | {vehicle.vehicle_type}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-accent">₪{vehicle.daily_rate}/יום</p>
                            <p className="text-sm text-muted-foreground">₪{vehicle.monthly_rate}/חודש</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>חזרה</Button>
                  <Button 
                    onClick={() => setStep(3)}
                    disabled={!formData.vehicle_id}
                    className="flex-1"
                  >
                    המשך
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (() => {
              const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id);
              const rateType = formData.rental_type as any;
              const ratePerUnit = formData.rental_cost ? Number(formData.rental_cost) : 0;
              const calcResult = rateType && ratePerUnit && formData.start_date && formData.end_date
                ? calculateRentalCost({
                    rateType,
                    ratePerUnit,
                    startDate: formData.start_date,
                    startTime: formData.start_time?.toString() || null,
                    endDate: formData.end_date,
                    endTime: formData.end_time?.toString() || null,
                    hourlyDelayRate: Number(selectedVehicle?.hourly_delay_rate ?? 0),
                  })
                : null;

              return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>סוג תעריף *</Label>
                    <Select 
                      value={formData.rental_type || ""} 
                      onValueChange={(v: any) => {
                        const rate = selectedVehicle ? getRateForType(selectedVehicle as any, v) : 0;
                        setFormData({ ...formData, rental_type: v, rental_cost: rate || formData.rental_cost });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר סוג תעריף" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="חצי יום">חצי יום{selectedVehicle?.half_day_rate ? ` (₪${selectedVehicle.half_day_rate})` : ""}</SelectItem>
                        <SelectItem value="24 שעות">24 שעות{selectedVehicle?.daily_rate ? ` (₪${selectedVehicle.daily_rate})` : ""}</SelectItem>
                        <SelectItem value="שבוע">שבוע{(selectedVehicle as any)?.weekly_rate ? ` (₪${(selectedVehicle as any).weekly_rate})` : ""}</SelectItem>
                        <SelectItem value="חודש">חודש{selectedVehicle?.monthly_rate ? ` (₪${selectedVehicle.monthly_rate})` : ""}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>תעריף ליחידה (₪)</Label>
                    <Input
                      type="number"
                      value={formData.rental_cost || ""}
                      onChange={(e) => setFormData({ ...formData, rental_cost: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {calcResult && calcResult.totalRentalCost > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">חישוב:</span>
                      <span>{calcResult.breakdown}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>סה"כ צפוי:</span>
                      <span>₪{calcResult.totalRentalCost.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>סכום מקדמה</Label>
                    <Input
                      type="number"
                      value={formData.deposit_amount || ""}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>מסגרת אשראי</Label>
                    <Input
                      type="number"
                      value={formData.credit_hold || ""}
                      onChange={(e) => setFormData({ ...formData, credit_hold: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>אמצעי תשלום</Label>
                    <Select 
                      value={formData.payment_method || ""} 
                      onValueChange={(v: any) => setFormData({ ...formData, payment_method: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="מזומן">מזומן</SelectItem>
                        <SelectItem value="אשראי">אשראי</SelectItem>
                        <SelectItem value="ביט">ביט</SelectItem>
                        <SelectItem value="צ׳ק">צ׳ק</SelectItem>
                        <SelectItem value="העברה בנקאית">העברה בנקאית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>סטטוס תשלום</Label>
                    <Select 
                      value={formData.payment_status || "לא שולם"} 
                      onValueChange={(v: any) => setFormData({ ...formData, payment_status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="לא שולם">לא שולם</SelectItem>
                        <SelectItem value="מקדמה">מקדמה</SelectItem>
                        <SelectItem value="שולם">שולם</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>סטטוס הזמנה</Label>
                    <Select 
                      value={formData.status || "מאושר"} 
                      onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ממתין">ממתין</SelectItem>
                        <SelectItem value="מאושר">משוריין</SelectItem>
                        <SelectItem value="בוטל">בוטל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* הגדרות תחנת השכרה (פר-השכרה) */}
                <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="require_credit_hold"
                      className="h-4 w-4"
                      checked={(formData as any).require_credit_hold !== false}
                      onChange={(e) => setFormData({ ...formData, require_credit_hold: e.target.checked } as any)}
                    />
                    <Label htmlFor="require_credit_hold" className="cursor-pointer">חובה לתפוס מסגרת בתחנה</Label>
                  </div>
                  <div>
                    <Label>תשלום מראש בתחנה</Label>
                    <Select
                      value={(formData as any).prepay_mode || "optional"}
                      onValueChange={(v: any) => setFormData({ ...formData, prepay_mode: v } as any)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="optional">אופציונלי</SelectItem>
                        <SelectItem value="mandatory">חובה (תשלום מלא)</SelectItem>
                        <SelectItem value="partial">חובה חלקית</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>הערות</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(selectedBooking ? 1 : 2)}>חזרה</Button>
                    <Button 
                      onClick={handleSubmit}
                      className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {selectedBooking ? "עדכון הזמנה" : "יצירת הזמנה"}
                    </Button>
                  </div>
                  {selectedBooking && selectedBooking.status !== "הושלם" && selectedBooking.status !== "בוטל" && (() => {
                    const cust = customers.find(c => c.id === (formData.customer_id || selectedBooking.customer_id));
                    const incomplete = cust && (!cust.phone || cust.phone === "0000000000" || !cust.license_front_url || !cust.license_back_url);
                    return (
                      <>
                        {incomplete && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                            ⚠️ פרטי לקוח חסרים - מומלץ להשלים בעמוד לקוחות (ניתן להמשיך בכל אופן)
                          </div>
                        )}
                        <Button
                          onClick={() => {
                            handleSubmit();
                            setTimeout(() => {
                              setWizardBooking(selectedBooking);
                              setRentalWizardOpen(true);
                            }, 500);
                          }}
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={createMutation.isPending || updateMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 ml-2" />
                          שמור והתחל השכרה
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Booking Details Dialog */}
      <Dialog open={!!viewingBooking} onOpenChange={() => setViewingBooking(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>פרטי הזמנה</DialogTitle>
          </DialogHeader>

          {viewingBooking && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground">לקוח</Label>
                  <p className="font-medium">{viewingBooking.customer_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">רכב</Label>
                  <p className="font-medium">{viewingBooking.vehicle_details}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך התחלה</Label>
                  <p className="font-medium">
                    {viewingBooking.start_date} {viewingBooking.start_time || ""}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">תאריך סיום</Label>
                  <p className="font-medium">
                    {viewingBooking.end_date} {viewingBooking.end_time || ""}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">עלות</Label>
                  <p className="font-medium text-lg">₪{viewingBooking.rental_cost?.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <StatusBadge status={viewingBooking.status} />
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-4">מסמכים וחתימות</h3>
                <DocumentsList
                  bookingId={viewingBooking.id}
                  customerPhone={customers.find(c => c.id === viewingBooking.customer_id)?.phone}
                  customerName={viewingBooking.customer_name}
                />
              </div>

              {(viewingBooking.deposit_amount || viewingBooking.credit_hold) && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">תשלום</h3>
                  <div className="space-y-2">
                    {viewingBooking.deposit_amount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">מקדמה:</span>
                        <span className="font-medium">₪{viewingBooking.deposit_amount.toLocaleString()}</span>
                      </div>
                    )}
                    {viewingBooking.credit_hold && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">מסגרת אשראי:</span>
                        <span className="font-medium">₪{viewingBooking.credit_hold.toLocaleString()}</span>
                      </div>
                    )}
                    {viewingBooking.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">אמצעי תשלום:</span>
                        <span className="font-medium">{viewingBooking.payment_method}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewingBooking.notes && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">הערות</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{viewingBooking.notes}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={() => setViewingBooking(null)} className="flex-1">סגור</Button>
                <Button variant="outline" onClick={() => {
                  handleEditBooking(viewingBooking);
                  setViewingBooking(null);
                }}>
                  עריכה
                </Button>
                {(viewingBooking.status === "פעיל" || viewingBooking.status === "הושלם") && (
                  <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => {
                    openEndRentalDialog(viewingBooking);
                    setViewingBooking(null);
                  }}>
                    {viewingBooking.status === "הושלם" ? "חיוב יתרה" : "סיים הזמנה"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmBooking} onOpenChange={(open) => { if (!open) setDeleteConfirmBooking(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת הזמנה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את ההזמנה של {deleteConfirmBooking?.customer_name}?
              {rentals.some(r => r.booking_id === deleteConfirmBooking?.id) && (
                <span className="block mt-2 text-red-600 font-medium">
                  שים לב: גם ההשכרה המקושרת תימחק מהיסטוריית ההשכרות.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmBooking && deleteMutation.mutate(deleteConfirmBooking)}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EndRentalDialog
        isOpen={endDialogOpen}
        booking={endDialogBooking}
        rental={endDialogRental}
        vehicle={vehicles.find((v) => v.id === (endDialogRental?.vehicle_id || endDialogBooking?.vehicle_id)) || null}
        onClose={() => {
          setEndDialogOpen(false);
          setEndDialogBooking(null);
          setEndDialogRental(null);
        }}
        onSaved={() => {
          setCalendarActionBooking(null);
          setCalendarActionRental(null);
        }}
      />

      {/* הפקת חשבונית מרשימת ההזמנות */}
      {(() => {
        const linkedRental = invoiceBooking ? rentals.find(r => r.booking_id === invoiceBooking.id) : null;
        return (
          <InvoiceDialog
            open={!!invoiceBooking}
            onOpenChange={(o) => { if (!o) setInvoiceBooking(null); }}
            rentalId={linkedRental?.id}
            defaultCustomerName={invoiceBooking?.customer_name || ""}
            defaultAmount={Number(linkedRental?.total_cost ?? invoiceBooking?.rental_cost ?? 0)}
            defaultPaymentMethod={invoiceBooking?.payment_method || ""}
            defaultVehicleDetails={invoiceBooking?.vehicle_details || ""}
            defaultPeriod={`${invoiceBooking?.start_date || ""} - ${invoiceBooking?.end_date || ""}`}
          />
        );
      })()}

      {/* Rental Start Wizard Dialog */}
      <Dialog open={rentalWizardOpen} onOpenChange={(open) => { if (!open) { setRentalWizardOpen(false); setWizardBooking(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>התחלת השכרה</DialogTitle>
          </DialogHeader>
          {wizardBooking && (
            <RentalStartWizard
              booking={wizardBooking}
              customer={customers.find(c => c.id === wizardBooking.customer_id) || null}
              vehicle={vehicles.find(v => v.id === wizardBooking.vehicle_id) || null}
              onComplete={handleWizardComplete}
              onCancel={() => { setRentalWizardOpen(false); setWizardBooking(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Maintenance Reservation Dialog */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={(open) => { if (!open) setMaintenanceDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                שריון לטיפול / תיקון
              </div>
            </DialogTitle>
          </DialogHeader>

          {maintenanceVehicle && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div><strong>רכב:</strong> {maintenanceVehicle.manufacturer} {maintenanceVehicle.model} - {maintenanceVehicle.license_plate}</div>
              </div>

              <div>
                <Label>סוג טיפול</Label>
                <Select value={maintenanceData.type} onValueChange={(v) => setMaintenanceData({ ...maintenanceData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="טיפול תקופתי">טיפול תקופתי</SelectItem>
                    <SelectItem value="החלפת שמן">החלפת שמן</SelectItem>
                    <SelectItem value="צמיגים">צמיגים</SelectItem>
                    <SelectItem value="בלמים">בלמים</SelectItem>
                    <SelectItem value="טסט">טסט</SelectItem>
                    <SelectItem value="חידוש רישוי">חידוש רישוי</SelectItem>
                    <SelectItem value="ביטוח">ביטוח</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>מתאריך</Label>
                  <Input
                    type="date"
                    value={maintenanceData.due_date}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>עד תאריך</Label>
                  <Input
                    type="date"
                    value={maintenanceData.end_date}
                    onChange={(e) => setMaintenanceData({ ...maintenanceData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* שעות שריון - לשריון חצי יום / טווח שעות (כשהשריון ליום בודד) */}
              {maintenanceData.due_date === maintenanceData.end_date && (
                <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">שעות שריון (אופציונלי - ריק = יום מלא)</Label>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => setMaintenanceData({ ...maintenanceData, start_time: "09:00", end_time: "13:00" })}>
                        חצי יום (בוקר)
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => setMaintenanceData({ ...maintenanceData, start_time: "14:00", end_time: "18:00" })}>
                        חצי יום (צהריים)
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => setMaintenanceData({ ...maintenanceData, start_time: "", end_time: "" })}>
                        נקה
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">משעה</Label>
                      <Input
                        type="time"
                        value={maintenanceData.start_time}
                        onChange={(e) => setMaintenanceData({ ...maintenanceData, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">עד שעה</Label>
                      <Input
                        type="time"
                        value={maintenanceData.end_time}
                        onChange={(e) => setMaintenanceData({ ...maintenanceData, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>תיאור (מה צריך לעשות / מי הנהג)</Label>
                <Textarea
                  value={maintenanceData.description}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
                  placeholder="פירוט הטיפול..."
                />
              </div>

              <div>
                <Label>הערות נוספות</Label>
                <Textarea
                  value={maintenanceData.notes}
                  onChange={(e) => setMaintenanceData({ ...maintenanceData, notes: e.target.value })}
                  placeholder="הערות..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={maintenanceData.activate_now}
                  onCheckedChange={(checked) => setMaintenanceData({ ...maintenanceData, activate_now: checked === true })}
                />
                <Label className="cursor-pointer">הפעל מיד (הרכב ייחסם כ"בטיפול")</Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => maintenanceMutation.mutate()}
                  disabled={maintenanceMutation.isPending}
                  className="flex-1"
                >
                  <Wrench className="w-4 h-4 ml-2" />
                  {maintenanceData.activate_now ? "צור והפעל" : "שמור שריון"}
                </Button>
                <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Maintenance Action Dialog */}
      <Dialog open={maintenanceActionOpen} onOpenChange={(open) => { if (!open) { setMaintenanceActionOpen(false); setMaintenanceActionTask(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                שריון טיפול
              </div>
            </DialogTitle>
          </DialogHeader>

          {maintenanceActionTask && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">רכב:</span>
                  <span className="font-medium">{maintenanceActionTask.vehicle_details}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סוג:</span>
                  <span className="font-medium">{maintenanceActionTask.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תאריך:</span>
                  <span className="font-medium">{maintenanceActionTask.due_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סטטוס:</span>
                  <StatusBadge status={maintenanceActionTask.status} />
                </div>
                {maintenanceActionTask.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">תיאור:</span>
                    <span className="font-medium">{maintenanceActionTask.description}</span>
                  </div>
                )}
                {maintenanceActionTask.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">הערות:</span>
                    <span className="font-medium">{maintenanceActionTask.notes}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {maintenanceActionTask.status === "ממתין" && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleActivateMaintenance(maintenanceActionTask)}
                    disabled={maintenanceUpdateMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    הפעל טיפול (חסום רכב)
                  </Button>
                )}

                {maintenanceActionTask.status === "בתהליך" && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handleCompleteMaintenance(maintenanceActionTask)}
                    disabled={maintenanceUpdateMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    סיים טיפול (שחרר רכב)
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMaintenanceEditData({
                      type: maintenanceActionTask.type,
                      description: maintenanceActionTask.description || "",
                      notes: maintenanceActionTask.notes || "",
                      end_date: maintenanceActionTask.due_date || "",
                    });
                    setMaintenanceEditOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4 ml-2" />
                  ערוך
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMaintenanceEditData({
                      type: maintenanceActionTask.type,
                      description: maintenanceActionTask.description || "",
                      notes: maintenanceActionTask.notes || "",
                      end_date: "",
                    });
                    setMaintenanceEditOpen(true);
                  }}
                >
                  <CalendarIcon className="w-4 h-4 ml-2" />
                  הארך שריון
                </Button>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => maintenanceDeleteMutation.mutate(maintenanceActionTask)}
                  disabled={maintenanceDeleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  מחק
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Maintenance Edit Dialog */}
      <Dialog open={maintenanceEditOpen} onOpenChange={(open) => { if (!open) setMaintenanceEditOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>עריכת שריון טיפול</DialogTitle>
          </DialogHeader>
          {maintenanceActionTask && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <div><strong>רכב:</strong> {maintenanceActionTask.vehicle_details}</div>
                <div><strong>תאריך נוכחי:</strong> {maintenanceActionTask.due_date}</div>
              </div>

              <div>
                <Label>סוג טיפול</Label>
                <Select value={maintenanceEditData.type} onValueChange={(v) => setMaintenanceEditData({ ...maintenanceEditData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="טיפול תקופתי">טיפול תקופתי</SelectItem>
                    <SelectItem value="החלפת שמן">החלפת שמן</SelectItem>
                    <SelectItem value="צמיגים">צמיגים</SelectItem>
                    <SelectItem value="בלמים">בלמים</SelectItem>
                    <SelectItem value="טסט">טסט</SelectItem>
                    <SelectItem value="חידוש רישוי">חידוש רישוי</SelectItem>
                    <SelectItem value="ביטוח">ביטוח</SelectItem>
                    <SelectItem value="אחר">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>הארך עד תאריך</Label>
                <Input
                  type="date"
                  value={maintenanceEditData.end_date}
                  onChange={(e) => setMaintenanceEditData({ ...maintenanceEditData, end_date: e.target.value })}
                />
              </div>

              <div>
                <Label>תיאור</Label>
                <Textarea
                  value={maintenanceEditData.description}
                  onChange={(e) => setMaintenanceEditData({ ...maintenanceEditData, description: e.target.value })}
                />
              </div>

              <div>
                <Label>הערות</Label>
                <Textarea
                  value={maintenanceEditData.notes}
                  onChange={(e) => setMaintenanceEditData({ ...maintenanceEditData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  disabled={maintenanceUpdateMutation.isPending}
                  onClick={async () => {
                    // Update current task
                    await maintenanceUpdateMutation.mutateAsync({
                      id: maintenanceActionTask.id,
                      data: {
                        type: maintenanceEditData.type as any,
                        description: maintenanceEditData.description || null,
                        notes: maintenanceEditData.notes || null,
                      }
                    });

                    // If extending, create new tasks for extra days
                    if (maintenanceEditData.end_date && maintenanceEditData.end_date > (maintenanceActionTask.due_date || "")) {
                      const vehicle = vehicles.find(v => v.id === maintenanceActionTask.vehicle_id);
                      if (vehicle) {
                        let cursor = addDays(parseISO(maintenanceActionTask.due_date || ""), 1);
                        const endDate = parseISO(maintenanceEditData.end_date);
                        const newRows: any[] = [];
                        while (!isAfter(cursor, endDate)) {
                          newRows.push({
                            vehicle_id: vehicle.id,
                            vehicle_details: `${vehicle.manufacturer} ${vehicle.model} - ${vehicle.license_plate}`,
                            type: maintenanceEditData.type as any,
                            due_date: format(cursor, "yyyy-MM-dd"),
                            description: maintenanceEditData.description || null,
                            notes: maintenanceEditData.notes || null,
                            status: maintenanceActionTask.status,
                          });
                          cursor = addDays(cursor, 1);
                        }
                        if (newRows.length > 0) {
                          await supabase.from("maintenance_tasks").insert(newRows);
                          queryClient.invalidateQueries({ queryKey: ["maintenance_tasks"] });
                        }
                      }
                    }

                    setMaintenanceEditOpen(false);
                    setMaintenanceActionOpen(false);
                    setMaintenanceActionTask(null);
                    toast({ title: "השריון עודכן בהצלחה" });
                  }}
                >
                  שמור
                </Button>
                <Button variant="outline" onClick={() => setMaintenanceEditOpen(false)}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Documents Viewer Dialog */}
      <Dialog open={docsViewerOpen} onOpenChange={(open) => { if (!open) { setDocsViewerOpen(false); setDocsViewerBookingId(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>מסמכים חתומים - {docsViewerCustomerName}</DialogTitle>
          </DialogHeader>
          {docsViewerBookingId && (
            <DocumentsList
              bookingId={docsViewerBookingId}
              customerName={docsViewerCustomerName}
              showActions={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
