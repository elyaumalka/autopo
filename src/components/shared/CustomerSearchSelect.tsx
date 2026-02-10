import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerSearchSelectProps {
  customers: Customer[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  showNone?: boolean;
  noneLabel?: string;
}

export function CustomerSearchSelect({
  customers,
  value,
  onValueChange,
  placeholder = "בחר לקוח...",
  showNone = false,
  noneLabel = "ללא לקוח",
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch("");
    }
  }, [open]);

  const filtered = customers.filter((c) => {
    const fullName = `${c.first_name} ${c.last_name}`;
    const term = search.trim();
    if (!term) return true;
    return (
      fullName.includes(term) ||
      c.phone?.includes(term) ||
      c.id_number?.includes(term)
    );
  });

  const selected = customers.find((c) => c.id === value);
  const displayText = selected
    ? `${selected.first_name} ${selected.last_name} - ${selected.phone}`
    : value === "none" && showNone
    ? noneLabel
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="חיפוש לפי שם, טלפון או ת.ז..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {showNone && (
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent cursor-pointer",
                  value === "none" && "bg-accent"
                )}
                onClick={() => {
                  onValueChange("none");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === "none" ? "opacity-100" : "opacity-0"
                  )}
                />
                {noneLabel}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                לא נמצאו לקוחות
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent cursor-pointer",
                    value === c.id && "bg-accent"
                  )}
                  onClick={() => {
                    onValueChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === c.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>
                    {c.first_name} {c.last_name} - {c.phone}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
