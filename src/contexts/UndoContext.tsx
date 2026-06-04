import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";

type UndoFn = () => Promise<void> | void;

interface UndoEntry {
  label: string;
  undo: UndoFn;
}

interface UndoContextValue {
  /** רישום פעולה הניתנת לביטול. מציג טוסט עם כפתור "בטל" וניתן לבטל גם ב-Ctrl+Z */
  registerUndo: (label: string, undo: UndoFn) => void;
  hasUndo: boolean;
  runUndo: () => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  const lastRef = useRef<UndoEntry | null>(null);
  const [hasUndo, setHasUndo] = useState(false);

  const runUndo = useCallback(async () => {
    const entry = lastRef.current;
    if (!entry) return;
    lastRef.current = null;
    setHasUndo(false);
    try {
      await entry.undo();
      toast({ title: "הפעולה בוטלה", description: entry.label });
    } catch (e: any) {
      toast({ title: "שגיאה בביטול הפעולה", description: e?.message, variant: "destructive" });
    }
  }, []);

  const registerUndo = useCallback((label: string, undo: UndoFn) => {
    lastRef.current = { label, undo };
    setHasUndo(true);
    toast({
      title: "בוצע: " + label,
      description: "ניתן לבטל עם Ctrl+Z",
    });
    // ביטול זמין ל-30 שניות
    window.setTimeout(() => {
      if (lastRef.current?.undo === undo) {
        lastRef.current = null;
        setHasUndo(false);
      }
    }, 30000);
  }, []);

  // מאזין גלובלי ל-Ctrl+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        const target = e.target as HTMLElement;
        // לא לתפוס Ctrl+Z בתוך שדות טקסט (משאירים את הביטול המקומי של השדה)
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
        if (lastRef.current) {
          e.preventDefault();
          runUndo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runUndo]);

  return (
    <UndoContext.Provider value={{ registerUndo, hasUndo, runUndo }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    // נסבל: אם לא עטוף בספק, מחזיר no-op כדי לא לשבור
    return { registerUndo: () => {}, hasUndo: false, runUndo: () => {} } as UndoContextValue;
  }
  return ctx;
}
