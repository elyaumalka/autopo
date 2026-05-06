import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/components/shared/DataTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Users, Search, Phone, Edit, Trash2, Eye, Upload, Loader2, Sparkles, FileText, ExternalLink, Copy, Send, CreditCard, Link, Globe, Plus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { PaymentButton } from "@/components/payments/PaymentButton";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type CustomerStatus = Database["public"]["Enums"]["customer_status"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type Rental = Database["public"]["Tables"]["rentals"]["Row"];

const statusOptions: CustomerStatus[] = ["פעיל", "לא פעיל", "חסום"];
const paymentMethodOptions: PaymentMethod[] = ["מזומן", "אשראי", "צ׳ק", "העברה בנקאית"];

interface CustomerFormData {
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  email?: string;
  address?: string;
  city?: string;
  status: CustomerStatus;
  payment_method?: PaymentMethod;
  notes?: string;
  license_front_url?: string;
  license_back_url?: string;
  is_foreign?: boolean;
  passport_url?: string;
  license_number?: string;
}

interface CustomerDocument {
  id: string;
  customer_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  notes: string | null;
  created_at: string;
}

export default function Customers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [formData, setFormData] = useState<Partial<CustomerFormData>>({});
  const [isProcessingLicense, setIsProcessingLicense] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: rentals = [] } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*");
      if (error) throw error;
      return data as Rental[];
    },
  });

  const { data: customerDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["customer-documents", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      const { data, error } = await supabase
        .from("customer_documents")
        .select("*")
        .eq("customer_id", selectedCustomer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomerDocument[];
    },
    enabled: !!selectedCustomer?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (customer: CustomerInsert) => {
      const { error } = await supabase.from("customers").insert(customer);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsOpen(false);
      setSelectedCustomer(null);
      setFormData({});
      toast({ title: "הלקוח נוסף בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { error } = await supabase.from("customers").update(customer).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsOpen(false);
      setSelectedCustomer(null);
      setFormData({});
      toast({ title: "הלקוח עודכן בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "הלקוח נמחק בהצלחה" });
    },
    onError: (error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("customer_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDocs();
      toast({ title: "המסמך נמחק" });
    },
  });

  const getCustomerRentals = (customerId: string) => {
    return rentals.filter(r => r.customer_id === customerId);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    
    const isForeign = formData.is_foreign || false;

    const customerData: any = {
      first_name: formData.first_name || form.get("first_name") as string,
      last_name: formData.last_name || form.get("last_name") as string,
      phone: formData.phone || form.get("phone") as string,
      id_number: formData.id_number || form.get("id_number") as string,
      email: formData.email || form.get("email") as string || null,
      address: formData.address || form.get("address") as string || null,
      city: formData.city || form.get("city") as string || null,
      payment_method: (form.get("payment_method") as PaymentMethod) || null,
      status: (form.get("status") as CustomerStatus) || "פעיל",
      notes: form.get("notes") as string || null,
      license_front_url: formData.license_front_url || null,
      license_back_url: formData.license_back_url || null,
      is_foreign: isForeign,
      passport_url: isForeign ? (formData.passport_url || null) : null,
      license_number: formData.license_number || null,
    };

    if (selectedCustomer) {
      updateMutation.mutate({ id: selectedCustomer.id, ...customerData });
    } else {
      createMutation.mutate(customerData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      id_number: customer.id_number,
      email: customer.email || undefined,
      address: customer.address || undefined,
      city: customer.city || undefined,
      status: customer.status,
      payment_method: customer.payment_method || undefined,
      notes: customer.notes || undefined,
      license_front_url: customer.license_front_url || undefined,
      license_back_url: customer.license_back_url || undefined,
      is_foreign: (customer as any).is_foreign || false,
      passport_url: (customer as any).passport_url || undefined,
      license_number: (customer as any).license_number || undefined,
    });
    setViewMode(false);
    setIsOpen(true);
  };

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      id_number: customer.id_number,
      email: customer.email || undefined,
      address: customer.address || undefined,
      city: customer.city || undefined,
      status: customer.status,
      payment_method: customer.payment_method || undefined,
      notes: customer.notes || undefined,
      license_front_url: customer.license_front_url || undefined,
      license_back_url: customer.license_back_url || undefined,
      is_foreign: (customer as any).is_foreign || false,
      passport_url: (customer as any).passport_url || undefined,
      license_number: (customer as any).license_number || undefined,
    });
    setViewMode(true);
    setIsOpen(true);
  };

  const openNewCustomer = () => {
    setSelectedCustomer(null);
    setFormData({});
    setViewMode(false);
    setIsOpen(true);
  };

  const handleFileUpload = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('customer-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('customer-documents')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingLicense(true);
    toast({ title: `מעלה את הצד ה${side === 'front' ? 'קדמי' : 'אחורי'}...` });

    try {
      const publicUrl = await handleFileUpload(file, 'licenses');

      if (side === 'front') {
        setFormData(prev => ({ ...prev, license_front_url: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, license_back_url: publicUrl }));
      }

      toast({ title: `הצד ה${side === 'front' ? 'קדמי' : 'אחורי'} הועלה בהצלחה!` });
    } catch (error) {
      console.error("Error uploading license:", error);
      toast({ title: "שגיאה בהעלאת הקובץ", variant: "destructive" });
    } finally {
      setIsProcessingLicense(false);
    }
  };

  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingLicense(true);
    try {
      const publicUrl = await handleFileUpload(file, 'passports');
      setFormData(prev => ({ ...prev, passport_url: publicUrl }));
      toast({ title: "הדרכון הועלה בהצלחה!" });
    } catch (error) {
      toast({ title: "שגיאה בהעלאת הקובץ", variant: "destructive" });
    } finally {
      setIsProcessingLicense(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCustomer) return;

    setIsUploadingDoc(true);
    try {
      const publicUrl = await handleFileUpload(file, `documents/${selectedCustomer.id}`);

      const { error } = await supabase.from("customer_documents").insert({
        customer_id: selectedCustomer.id,
        document_name: file.name,
        document_type: "אחר",
        file_url: publicUrl,
      });
      if (error) throw error;

      refetchDocs();
      toast({ title: "המסמך הועלה בהצלחה!" });
    } catch (error) {
      toast({ title: "שגיאה בהעלאת המסמך", variant: "destructive" });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name}`.includes(searchTerm) ||
    c.phone?.includes(searchTerm) ||
    c.id_number?.includes(searchTerm)
  );

  const isForeign = formData.is_foreign || false;

  const columns = [
    {
      header: "שם",
      cell: (row: Customer) => (
        <div className="font-medium flex items-center gap-1">
          {(row as any).is_foreign && <Globe className="w-3.5 h-3.5 text-blue-500" />}
          {row.first_name} {row.last_name}
        </div>
      )
    },
    {
      header: "טלפון",
      cell: (row: Customer) => (
        <a href={`tel:${row.phone}`} className="text-cyan-600 hover:underline flex items-center gap-1">
          <Phone className="w-4 h-4" />
          {row.phone}
        </a>
      )
    },
    { 
      header: "ת.ז./דרכון", 
      cell: (row: Customer) => row.id_number 
    },
    { 
      header: "עיר", 
      cell: (row: Customer) => row.city || "-"
    },
    {
      header: "סטטוס",
      cell: (row: Customer) => <StatusBadge status={row.status || "פעיל"} />
    },
    {
      header: "השכרות",
      cell: (row: Customer) => getCustomerRentals(row.id).length
    },
    {
      header: "רישיון",
      cell: (row: Customer) => (
        <div className="flex items-center gap-1">
          {row.license_front_url && row.license_back_url ? (
            <span className="text-green-600 text-xs font-medium">✓ הועלה</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-cyan-600"
              onClick={() => {
                const url = `${window.location.origin}/customer-upload?token=${(row as any).upload_token}`;
                const phone = row.phone?.replace(/^0/, "972");
                const text = encodeURIComponent(`שלום ${row.first_name},\nנא להעלות תמונות רישיון נהיגה:\n${url}`);
                window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
              }}
            >
              <Send className="w-3 h-3 ml-1" />
              שלח קישור
            </Button>
          )}
        </div>
      )
    },
    {
      header: "סליקה",
      cell: (row: Customer) => (
        <PaymentButton
          defaultAction="charge"
          label="סליקה"
          variant="outline"
          size="sm"
          customer={{
            id: row.id,
            name: `${row.first_name} ${row.last_name}`,
            phone: row.phone, email: row.email || undefined,
            address: row.address || undefined, city: row.city || undefined,
            citizenId: row.id_number,
            payment_token: (row as any).payment_token,
            card_last4: (row as any).card_last4,
            card_expiry: (row as any).card_expiry,
          }}
          hasSavedCard={!!(row as any).payment_token}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
        />
      ),
    },
    {
      header: "פעולות",
      cell: (row: Customer) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleView(row)} title="צפייה">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row)} title="עריכה">
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="העתק קישור העלאת רישיון"
            onClick={() => {
              const url = `${window.location.origin}/customer-upload?token=${(row as any).upload_token}`;
              navigator.clipboard.writeText(url);
              toast({ title: "הקישור הועתק!" });
            }}
          >
            <Link className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate(row.id)}
            title="מחיקה"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle={`${customers.length} לקוחות רשומים`}
        icon={Users}
        action={<Button onClick={openNewCustomer}><Users className="ml-2 h-4 w-4" />לקוח חדש</Button>}
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="חיפוש לפי שם, טלפון או ת.ז..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredCustomers}
        isLoading={isLoading}
        emptyMessage="לא נמצאו לקוחות"
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode ? "פרטי לקוח" : selectedCustomer ? "עריכת לקוח" : "לקוח חדש"}
            </DialogTitle>
          </DialogHeader>

          {viewMode && selectedCustomer ? (
            <div className="space-y-6">
              {(selectedCustomer as any).is_foreign && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-blue-700 text-sm">
                  <Globe className="w-4 h-4" />
                  לקוח חו״ל
                </div>
              )}

              {/* License & Passport Images */}
              {(selectedCustomer.license_front_url || selectedCustomer.license_back_url || (selectedCustomer as any).passport_url) && (
                <div>
                  <h3 className="font-semibold mb-3">מסמכי זיהוי</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCustomer.license_front_url && (
                      <div>
                        <Label className="text-gray-500 mb-2 block">רישיון - קדמי</Label>
                        <a href={selectedCustomer.license_front_url} target="_blank" rel="noopener noreferrer">
                          <img src={selectedCustomer.license_front_url} alt="רישיון קדמי" className="w-full h-48 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                        </a>
                      </div>
                    )}
                    {selectedCustomer.license_back_url && (
                      <div>
                        <Label className="text-gray-500 mb-2 block">רישיון - אחורי</Label>
                        <a href={selectedCustomer.license_back_url} target="_blank" rel="noopener noreferrer">
                          <img src={selectedCustomer.license_back_url} alt="רישיון אחורי" className="w-full h-48 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                        </a>
                      </div>
                    )}
                    {(selectedCustomer as any).passport_url && (
                      <div>
                        <Label className="text-gray-500 mb-2 block">דרכון</Label>
                        <a href={(selectedCustomer as any).passport_url} target="_blank" rel="noopener noreferrer">
                          <img src={(selectedCustomer as any).passport_url} alt="דרכון" className="w-full h-48 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">שם מלא</Label>
                  <p className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">{(selectedCustomer as any).is_foreign ? "מספר דרכון" : "ת.ז."}</Label>
                  <p className="font-medium">{selectedCustomer.id_number}</p>
                </div>
                {(selectedCustomer as any).license_number && (
                <div>
                  <Label className="text-gray-500">מספר רישיון</Label>
                  <p className="font-medium">{(selectedCustomer as any).license_number}</p>
                </div>
                )}
                <div>
                  <Label className="text-gray-500">טלפון</Label>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <Label className="text-gray-500">מייל</Label>
                  <p className="font-medium">{selectedCustomer.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">כתובת</Label>
                  <p className="font-medium">{selectedCustomer.address || "-"}, {selectedCustomer.city || "-"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">סטטוס</Label>
                  <StatusBadge status={selectedCustomer.status} />
                </div>
              </div>

              {/* Active Rentals */}
              {(() => {
                const activeRentals = getCustomerRentals(selectedCustomer.id).filter(r => r.status === "פעיל");
                return activeRentals.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-green-700">השכרות פעילות</h3>
                    <div className="space-y-2">
                      {activeRentals.map((rental) => (
                        <div key={rental.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{rental.vehicle_details}</p>
                              <p className="text-sm text-muted-foreground">
                                {rental.start_date ? format(new Date(rental.start_date), "dd/MM/yyyy") : "-"}
                                {rental.planned_end_date && ` - ${format(new Date(rental.planned_end_date), "dd/MM/yyyy")}`}
                              </p>
                            </div>
                            <StatusBadge status={rental.status} />
                          </div>
                          <div className="mt-2 flex gap-4 text-sm">
                            <span>סה"כ: ₪{rental.total_cost?.toLocaleString() || rental.base_cost?.toLocaleString() || 0}</span>
                            <span className="text-green-600">שולם: ₪{rental.paid_amount?.toLocaleString() || 0}</span>
                            {(rental.remaining_payment || 0) > 0 && (
                              <span className="text-red-600 font-medium">חוב: ₪{rental.remaining_payment?.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Rental History */}
              <div>
                <h3 className="font-semibold mb-3">היסטוריית השכרות</h3>
                {getCustomerRentals(selectedCustomer.id).filter(r => r.status !== "פעיל").length === 0 ? (
                  <p className="text-gray-500">אין השכרות קודמות</p>
                ) : (
                  <div className="space-y-2">
                    {getCustomerRentals(selectedCustomer.id).filter(r => r.status !== "פעיל").map((rental) => (
                      <div key={rental.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{rental.vehicle_details}</p>
                            <p className="text-sm text-gray-500">
                              {rental.start_date ? format(new Date(rental.start_date), "dd/MM/yyyy") : "-"}
                              {rental.actual_end_date && ` - ${format(new Date(rental.actual_end_date), "dd/MM/yyyy")}`}
                            </p>
                          </div>
                          <StatusBadge status={rental.status} />
                        </div>
                        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                          <span>סה"כ: ₪{rental.total_cost?.toLocaleString() || 0}</span>
                          <span>שולם: ₪{rental.paid_amount?.toLocaleString() || 0}</span>
                          {(rental.remaining_payment || 0) > 0 && (
                            <span className="text-red-600 font-medium">חוב: ₪{rental.remaining_payment?.toLocaleString()}</span>
                          )}
                          {rental.invoice_number && <span>חשבונית: {rental.invoice_number}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Debts Summary */}
              {(() => {
                const totalDebt = getCustomerRentals(selectedCustomer.id)
                  .reduce((sum, r) => sum + (r.remaining_payment || 0), 0);
                return totalDebt > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700 font-medium">סה"כ חובות פתוחים</p>
                    <p className="text-2xl font-bold text-red-700">₪{totalDebt.toLocaleString()}</p>
                  </div>
                );
              })()}

              <Button onClick={() => setViewMode(false)} className="w-full">
                עריכה
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">פרטים בסיסיים</TabsTrigger>
                  <TabsTrigger value="documents">מסמכים</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  {/* Foreign Customer Toggle */}
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <Label htmlFor="is_foreign" className="cursor-pointer">לקוח חו״ל</Label>
                    </div>
                    <Switch
                      id="is_foreign"
                      checked={isForeign}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_foreign: checked }))}
                    />
                  </div>

                  {/* License Upload Section */}
                  <div className="border-2 border-dashed border-cyan-300 rounded-lg p-6 bg-cyan-50">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-cyan-600" />
                        <h3 className="font-semibold text-cyan-900">העלאת רישיון נהיגה</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">העלה את שני צדי הרישיון</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-sm font-medium mb-2 text-gray-700">צד קדמי</p>
                          <Button type="button" variant="outline" onClick={() => document.getElementById("license-front-upload")?.click()} disabled={isProcessingLicense} className="w-full border-cyan-600 text-cyan-600 hover:bg-cyan-50">
                            {isProcessingLicense ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</> : <><Upload className="w-4 h-4 ml-2" />{formData.license_front_url ? "הועלה ✓" : "העלה"}</>}
                          </Button>
                          <input id="license-front-upload" type="file" accept="image/*" onChange={(e) => handleLicenseUpload(e, 'front')} className="hidden" />
                          {formData.license_front_url && <a href={formData.license_front_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:underline block mt-1">צפה בתמונה</a>}
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium mb-2 text-gray-700">צד אחורי</p>
                          <Button type="button" variant="outline" onClick={() => document.getElementById("license-back-upload")?.click()} disabled={isProcessingLicense} className="w-full border-cyan-600 text-cyan-600 hover:bg-cyan-50">
                            {isProcessingLicense ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</> : <><Upload className="w-4 h-4 ml-2" />{formData.license_back_url ? "הועלה ✓" : "העלה"}</>}
                          </Button>
                          <input id="license-back-upload" type="file" accept="image/*" onChange={(e) => handleLicenseUpload(e, 'back')} className="hidden" />
                          {formData.license_back_url && <a href={formData.license_back_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 hover:underline block mt-1">צפה בתמונה</a>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Passport Upload - Only for foreign customers */}
                  {isForeign && (
                    <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-blue-50">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Globe className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-blue-900">העלאת דרכון</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">העלה צילום של הדרכון</p>
                        <Button type="button" variant="outline" onClick={() => document.getElementById("passport-upload")?.click()} disabled={isProcessingLicense} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                          {isProcessingLicense ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" />מעבד...</> : <><Upload className="w-4 h-4 ml-2" />{formData.passport_url ? "הועלה ✓" : "העלה דרכון"}</>}
                        </Button>
                        <input id="passport-upload" type="file" accept="image/*" onChange={handlePassportUpload} className="hidden" />
                        {formData.passport_url && <a href={formData.passport_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mt-2">צפה בתמונה</a>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">שם פרטי *</Label>
                      <Input id="first_name" name="first_name" value={formData.first_name || ""} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="last_name">שם משפחה *</Label>
                      <Input id="last_name" name="last_name" value={formData.last_name || ""} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">טלפון *</Label>
                      <Input id="phone" name="phone" type="tel" value={formData.phone || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="id_number">{isForeign ? "מספר דרכון *" : "ת.ז. *"}</Label>
                      <Input id="id_number" name="id_number" value={formData.id_number || ""} onChange={(e) => setFormData({ ...formData, id_number: e.target.value })} required placeholder={isForeign ? "מספר דרכון" : "תעודת זהות"} />
                    </div>
                    <div>
                      <Label htmlFor="license_number">מספר רישיון נהיגה</Label>
                      <Input id="license_number" name="license_number" value={formData.license_number || ""} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} placeholder="מספר רישיון נהיגה" />
                    </div>
                    <div>
                      <Label htmlFor="email">מייל</Label>
                      <Input id="email" name="email" type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="address">כתובת</Label>
                      <Input id="address" name="address" value={formData.address || ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="city">{isForeign ? "מדינה" : "עיר"}</Label>
                      <Input id="city" name="city" value={formData.city || ""} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder={isForeign ? "מדינה" : "עיר"} />
                    </div>
                    <div>
                      <Label htmlFor="status">סטטוס</Label>
                      <Select name="status" defaultValue={selectedCustomer?.status || "פעיל"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="payment_method">אמצעי תשלום מועדף</Label>
                      <Select name="payment_method" defaultValue={selectedCustomer?.payment_method || undefined}>
                        <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                        <SelectContent>
                          {paymentMethodOptions.map((method) => (
                            <SelectItem key={method} value={method}>{method}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">הערות</Label>
                    <Textarea id="notes" name="notes" value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  {/* License images */}
                  <div className="grid grid-cols-1 gap-4">
                    {formData.license_front_url && (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">רישיון נהיגה - קדמי</span>
                          <Button type="button" size="sm" variant="outline" onClick={() => window.open(formData.license_front_url, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                        <img src={formData.license_front_url} alt="רישיון קדמי" className="w-full h-32 object-cover rounded" />
                      </div>
                    )}
                    {formData.license_back_url && (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">רישיון נהיגה - אחורי</span>
                          <Button type="button" size="sm" variant="outline" onClick={() => window.open(formData.license_back_url, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                        <img src={formData.license_back_url} alt="רישיון אחורי" className="w-full h-32 object-cover rounded" />
                      </div>
                    )}
                    {formData.passport_url && (
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">דרכון</span>
                          <Button type="button" size="sm" variant="outline" onClick={() => window.open(formData.passport_url, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                        <img src={formData.passport_url} alt="דרכון" className="w-full h-32 object-cover rounded" />
                      </div>
                    )}
                  </div>

                  {/* General documents */}
                  {selectedCustomer && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">מסמכים נוספים</h3>
                        <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("doc-upload")?.click()} disabled={isUploadingDoc}>
                          {isUploadingDoc ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
                          העלה מסמך
                        </Button>
                        <input id="doc-upload" type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleDocUpload} className="hidden" />
                      </div>

                      {customerDocs.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">אין מסמכים נוספים</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {customerDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{doc.document_name}</p>
                                  <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</p>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button type="button" size="icon" variant="ghost" onClick={() => window.open(doc.file_url, '_blank')}>
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDocMutation.mutate(doc.id)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!selectedCustomer && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>שמור את הלקוח קודם כדי להעלות מסמכים</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <LoadingSpinner size="sm" /> : selectedCustomer ? "עדכון" : "שמור"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>ביטול</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
