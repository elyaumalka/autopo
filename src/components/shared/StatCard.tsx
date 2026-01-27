import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "destructive" | "info" | "cyan" | "blue" | "green" | "red" | "orange" | "purple";
  isCurrency?: boolean;
  subtitle?: string;
  trend?: number;
  className?: string;
}

const colorClasses: Record<string, { bg: string; icon: string; border: string }> = {
  primary: { bg: "bg-primary/10", icon: "text-primary", border: "border-primary/20" },
  success: { bg: "bg-green-100", icon: "text-green-600", border: "border-green-200" },
  warning: { bg: "bg-yellow-100", icon: "text-yellow-600", border: "border-yellow-200" },
  destructive: { bg: "bg-red-100", icon: "text-red-600", border: "border-red-200" },
  info: { bg: "bg-blue-100", icon: "text-blue-600", border: "border-blue-200" },
  cyan: { bg: "bg-cyan-100", icon: "text-cyan-600", border: "border-cyan-200" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", border: "border-blue-200" },
  green: { bg: "bg-green-100", icon: "text-green-600", border: "border-green-200" },
  red: { bg: "bg-red-100", icon: "text-red-600", border: "border-red-200" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600", border: "border-orange-200" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600", border: "border-purple-200" },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "primary",
  isCurrency = false,
  subtitle,
  trend,
  className,
}: StatCardProps) {
  const colors = colorClasses[color] || colorClasses.primary;
  
  const displayValue = typeof value === "string" 
    ? value 
    : isCurrency 
      ? formatCurrency(value) 
      : formatNumber(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-2xl p-6 border shadow-sm hover:shadow-md transition-shadow",
        colors.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2 text-gray-900">
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          )}
          {trend !== undefined && (
            <p className={cn(
              "text-sm mt-2",
              trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-gray-500"
            )}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}% מהחודש הקודם
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", colors.bg)}>
          <Icon className={cn("w-6 h-6", colors.icon)} />
        </div>
      </div>
    </motion.div>
  );
}
