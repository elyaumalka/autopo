import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { UserPlus, Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerNameInputProps {
  customers: Customer[];
  /** מזהה הלקוח הנבחר (ריק אם לקוח חדש שהוקלד) */
  customerId: string;
  /** השם המוצג בשדה (של לקוח קיים או שם חדש שהוקלד) */
  customerName: string;
  /** נקרא בכל שינוי - או לקוח קיים נבחר (עם id) או שם חדש (id ריק) */
  onChange: (value: { customerId: string; customerName: string }) => void;
  placeholder?: string;
}

/**
 * שדה לקוח אינטואיטיבי: מקלידים שם → רואים הצעות מהרשימה → לוחצים על אחת,
 * או ממשיכים להקליד שם שלא קיים והוא יוגדר אוטומטית כלקוח חדש.
 */
export function CustomerNameInput({
  customers,
  customerId,
  customerName,
  onChange,
  placeholder = "הקלד שם לקוח או בחר מהרשימה",
}: CustomerNameInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(customerName || "");
  const containerRef = useRef<HTMLDivElement>(null);

  // סנכרון התצוגה כשהערך משתנה מבחוץ
  useEffect(() => {
    setQuery(customerName || "");
  }, [customerName]);

  // סגירה בלחיצה מחוץ לרכיב
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const term = query.trim();
  const filtered = term
    ? customers.filter((c) => {
        const full = `${c.first_name} ${c.last_name}`;
        return full.includes(term) || c.phone?.includes(term) || c.id_number?.includes(term);
      }).slice(0, 8)
    : customers.slice(0, 8);

  const hasExactMatch = customers.some((c) => `${c.first_name} ${c.last_name}`.trim() === term);

  const selectExisting = (c: Customer) => {
    onChange({ customerId: c.id, customerName: `${c.first_name} ${c.last_name}` });
    setQuery(`${c.first_name} ${c.last_name}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          // הקלדה = לקוח חדש (מאפס בחירת לקוח קיים)
          onChange({ customerId: "", customerName: v });
        }}
      />
      {customerId && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 text-xs flex items-center gap-1 pointer-events-none">
          <Check className="h-3 w-3" /> לקוח קיים
        </span>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-right hover:bg-accent"
                onClick={() => selectExisting(c)}
              >
                <Check className={`h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                <span>{c.first_name} {c.last_name} - {c.phone}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">לא נמצאו לקוחות תואמים</div>
          )}

          {term && !hasExactMatch && (
            <div className="border-t px-3 py-2 text-sm text-green-700 flex items-center gap-2">
              <UserPlus className="h-4 w-4 shrink-0" />
              <span>"{term}" יוגדר כלקוח חדש</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
