import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Rental = Tables<"rentals">;

interface HoldRow {
  key: string;
  source: "rental" | "booking";
  rentalId?: string;
  bookingId?: string;
  customerName: string;
  date: string;
  status: string;
  amount: number;
  authNumber: string;
}

export default function CreditHolds() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rentalHolds = [], isLoading: l1, refetch: r1 } = useQuery({
    queryKey: ["credit-holds-rentals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*").not("sumit_auth_number", "is", null);
      if (error) throw error;
      return data as Rental[];
    },
  });

  const { data: bookingHolds = [], isLoading: l2, refetch: r2 } = useQuery({
    queryKey: ["credit-holds-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").not("sumit_auth_number", "is", null);
      if (error) throw error;
      return data as Booking[];
    },
  });

  // איחוד: השכרות + הזמנות עם תפיסה, דה-דופ לפי מספר אישור (מעדיפים את ההשכרה)
  const rowsByAuth = new Map<string, HoldRow>();
  rentalHolds.forEach((r) => {
    const auth = String(r.sumit_auth_number);
    rowsByAuth.set(auth, {
      key: `r-${r.id}`,
      source: "rental",
      rentalId: r.id,
      bookingId: r.booking_id || undefined,
      customerName: r.customer_name || "-",
      date: r.start_date,
      status: r.status || "פעיל",
      amount: Number(r.sumit_authorized_amount || r.credit_hold || 0),
      authNumber: auth,
    });
  });
  bookingHolds.forEach((b) => {
    const auth = String(b.sumit_auth_number);
    if (rowsByAuth.has(auth)) return; // כבר מיוצג ע"י השכרה
    rowsByAuth.set(auth, {
      key: `b-${b.id}`,
      source: "booking",
      bookingId: b.id,
      customerName: b.customer_name || "-",
      date: b.start_date,
      status: b.status,
      amount: Number(b.sumit_authorized_amount || b.credit_hold || 0),
      authNumber: auth,
    });
  });

  const allRows = Array.from(rowsByAuth.values());
  const filtered = allRows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    const term = search.trim();
    if (!term) return true;
    return row.customerName.includes(term) || row.authNumber.includes(term);
  });

  const totalHeld = filtered.reduce((s, r) => s + r.amount, 0);

  const release = async (row: HoldRow) => {
    setBusy(row.key);
    try {
      const { data, error } = await supabase.functions.invoke("sumit-payment", {
        body: { action: "release_authorization", rentalId: row.rentalId, bookingId: row.bookingId, authNumber: row.authNumber, amount: row.amount },
      });
      if (error) {
        let detail = error.message;
        try { const body = await (error as any).context?.json?.(); detail = body?.raw?.UserErrorMessage || body?.error || detail; } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (!(data as any)?.success) throw new Error((data as any)?.raw?.UserErrorMessage || "שחרור נכשל");
      // ניקוי מקומי בשני המקורות (הזמנה + השכרה) עם אותו מספר אישור
      const clear = { sumit_auth_number: null, sumit_authorized_amount: null, sumit_authorized_at: null } as any;
      await supabase.from("rentals").update(clear).eq("sumit_auth_number", row.authNumber);
      await supabase.from("bookings").update(clear).eq("sumit_auth_number", row.authNumber);
      toast({ title: "המסגרת שוחררה בהצלחה" });
      r1(); r2();
    } catch (e: any) {
      toast({ title: "שגיאה בשחרור מסגרת", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="תפיסות מסגרת" subtitle={`${allRows.length} תפיסות פעילות`} />

      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder="חיפוש לפי שם לקוח או מספר אישור..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="מאושר">משוריין</SelectItem>
              <SelectItem value="פעיל">פעיל</SelectItem>
              <SelectItem value="הושלם">הושלם</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-4 rounded-lg bg-muted/50 text-sm whitespace-nowrap">
            <span className="text-muted-foreground">סה"כ תפוס:</span>
            <span className="font-bold">₪{totalHeld.toLocaleString()}</span>
          </div>
        </div>

        {(l1 || l2) ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{search || statusFilter !== "all" ? "לא נמצאו תפיסות תואמות" : "אין תפיסות מסגרת פעילות"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">שם הלקוח</th>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">תאריך השכרה</th>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">סטטוס</th>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">סכום התפיסה</th>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">מספר אישור</th>
                  <th className="h-11 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">שחרור</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.key} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-3 font-medium">{row.customerName}</td>
                    <td className="px-3 py-3">{row.date ? format(new Date(row.date), "dd/MM/yy") : "-"}</td>
                    <td className="px-3 py-3"><StatusBadge status={row.status === "מאושר" ? "משוריין" : row.status} /></td>
                    <td className="px-3 py-3 font-semibold">₪{row.amount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-muted-foreground" dir="ltr">{row.authNumber}</td>
                    <td className="px-3 py-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50" disabled={busy === row.key}>
                            {busy === row.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-4 h-4 ml-1" /> שחרר</>}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>שחרור תפיסת מסגרת</AlertDialogTitle>
                            <AlertDialogDescription>
                              לשחרר את תפיסת המסגרת של {row.customerName} בסך ₪{row.amount.toLocaleString()}? פעולה זו תבטל את ה-J5 בסומיט.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => release(row)}>שחרר</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
