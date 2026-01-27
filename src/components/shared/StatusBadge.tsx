import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        // Vehicle statuses
        זמין: "bg-green-100 text-green-800",
        מושכר: "bg-blue-100 text-blue-800",
        בטיפול: "bg-yellow-100 text-yellow-800",
        תאונה: "bg-red-100 text-red-800",
        "לא פעיל": "bg-gray-100 text-gray-800",
        נמכר: "bg-purple-100 text-purple-800",
        
        // Booking/Rental statuses
        ממתין: "bg-yellow-100 text-yellow-800",
        מאושר: "bg-blue-100 text-blue-800",
        פעיל: "bg-green-100 text-green-800",
        הושלם: "bg-gray-100 text-gray-800",
        בוטל: "bg-red-100 text-red-800",
        
        // Payment statuses
        "לא שולם": "bg-red-100 text-red-800",
        מקדמה: "bg-yellow-100 text-yellow-800",
        שולם: "bg-green-100 text-green-800",
        
        // Customer statuses - using aliases
        חסום: "bg-red-100 text-red-800",
        
        // Collection task statuses
        פתוח: "bg-red-100 text-red-800",
        נסגר: "bg-gray-100 text-gray-800",
        חלקי: "bg-orange-100 text-orange-800",
        
        // Traffic ticket statuses
        חדש: "bg-red-100 text-red-800",
        "הועבר ללקוח": "bg-yellow-100 text-yellow-800",
        בערעור: "bg-purple-100 text-purple-800",
        
        // Accident statuses
        "בהמתנה לביטוח": "bg-orange-100 text-orange-800",
        
        // Priority
        נמוכה: "bg-gray-100 text-gray-800",
        בינונית: "bg-yellow-100 text-yellow-800",
        גבוהה: "bg-orange-100 text-orange-800",
        דחוף: "bg-red-100 text-red-800",
        
        // Default
        default: "bg-gray-100 text-gray-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant: status as any }), className)}
      {...props}
    >
      {status}
    </span>
  );
}
