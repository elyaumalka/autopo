import { LucideIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode | (() => void);
  actionLabel?: string;
  actionIcon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  actionLabel,
  actionIcon: ActionIcon = Plus,
  className,
  children,
}: PageHeaderProps) {
  const isActionCallback = typeof action === "function";

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8", className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">
            <Icon className="h-6 w-6 text-cyan-600" />
          </div>
        )}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
        {isActionCallback && actionLabel ? (
          <Button 
            onClick={action}
            className="bg-cyan-600 hover:bg-cyan-700 shadow-lg shadow-cyan-600/30"
          >
            <ActionIcon className="w-5 h-5 ml-2" />
            {actionLabel}
          </Button>
        ) : !isActionCallback ? (
          action
        ) : null}
      </div>
    </div>
  );
}
