import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "destructive" | "info" | "cyan" | "blue" | "green" | "red" | "orange" | "purple";
  isCurrency?: boolean;
  subtitle?: string;
  className?: string;
}

const colorClasses: Record<string, { bg: string; icon: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary" },
  success: { bg: "bg-green-100", icon: "text-green-600" },
  warning: { bg: "bg-yellow-100", icon: "text-yellow-600" },
  destructive: { bg: "bg-red-100", icon: "text-red-600" },
  info: { bg: "bg-blue-100", icon: "text-blue-600" },
  cyan: { bg: "bg-cyan-100", icon: "text-cyan-600" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600" },
  green: { bg: "bg-green-100", icon: "text-green-600" },
  red: { bg: "bg-red-100", icon: "text-red-600" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600" },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "primary",
  isCurrency = false,
  subtitle,
  className,
}: StatCardProps) {
  const colors = colorClasses[color] || colorClasses.primary;
  
  const displayValue = typeof value === "string" 
    ? value 
    : isCurrency 
      ? formatCurrency(value) 
      : formatNumber(value);

  return (
    <div className={cn(
      "rounded-2xl bg-white border p-6 shadow-sm transition-all duration-300 hover:shadow-md",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {displayValue}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-xl p-3", colors.bg)}>
          <Icon className={cn("h-6 w-6", colors.icon)} />
        </div>
      </div>
    </div>
  );
}
