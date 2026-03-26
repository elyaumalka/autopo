import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  // Booking/Rental statuses
  "מאושר": "bg-blue-100 text-blue-800 border-blue-200",
  "משוריין": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "פעיל": "bg-green-100 text-green-800 border-green-200",
  "הושלם": "bg-gray-100 text-gray-800 border-gray-200",
  "בוטל": "bg-red-100 text-red-800 border-red-200",
  "ממתין": "bg-yellow-100 text-yellow-800 border-yellow-200",
  
  // Vehicle statuses
  "זמין": "bg-green-100 text-green-800 border-green-200",
  "מושכר": "bg-blue-100 text-blue-800 border-blue-200",
  "בטיפול": "bg-orange-100 text-orange-800 border-orange-200",
  "תאונה": "bg-red-100 text-red-800 border-red-200",
  "לא פעיל": "bg-gray-100 text-gray-800 border-gray-200",
  "נמכר": "bg-purple-100 text-purple-800 border-purple-200",
  
  // Payment statuses
  "לא שולם": "bg-red-100 text-red-800 border-red-200",
  "מקדמה": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "שולם": "bg-green-100 text-green-800 border-green-200",
  
  // Customer statuses
  "חסום": "bg-red-100 text-red-800 border-red-200",
  
  // Task statuses
  "בתהליך": "bg-blue-100 text-blue-800 border-blue-200",
  
  // Collection statuses
  "פתוח": "bg-red-100 text-red-800 border-red-200",
  "חלקי": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "נסגר": "bg-green-100 text-green-800 border-green-200",
  
  // Accident statuses
  "בהמתנה לביטוח": "bg-purple-100 text-purple-800 border-purple-200",
  
  // Traffic ticket statuses
  "חדש": "bg-red-100 text-red-800 border-red-200",
  "הועבר ללקוח": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "בערעור": "bg-purple-100 text-purple-800 border-purple-200",
  
  // Priority
  "נמוכה": "bg-gray-100 text-gray-800 border-gray-200",
  "בינונית": "bg-blue-100 text-blue-800 border-blue-200",
  "גבוהה": "bg-orange-100 text-orange-800 border-orange-200",
  "דחוף": "bg-red-100 text-red-800 border-red-200",
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  
  return (
    <Badge 
      variant="outline" 
      className={cn(style, "font-medium", className)}
    >
      {status}
    </Badge>
  );
}
