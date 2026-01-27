import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  isCurrency?: boolean;
  subtitle?: string;
  className?: string;
}

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-600",
  warning: "bg-yellow-100 text-yellow-600",
  destructive: "bg-red-100 text-red-600",
  info: "bg-blue-100 text-blue-600",
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
  return (
    <div className={cn("rounded-2xl bg-card p-6 shadow-lg", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {isCurrency ? formatCurrency(value) : formatNumber(value)}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-lg p-3", colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
