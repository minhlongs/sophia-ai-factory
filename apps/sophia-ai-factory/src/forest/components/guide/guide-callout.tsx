import { cn } from "@/lib/utils";
import { Info, Lightbulb, AlertTriangle, Zap } from "lucide-react";
import { ReactNode } from "react";

type CalloutVariant = "tip" | "warning" | "info" | "important";

const VARIANT_CONFIG: Record<CalloutVariant, {
  icon: typeof Info;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  titleColor: string;
  label: string;
}> = {
  tip: {
    icon: Lightbulb,
    borderColor: "border-l-cyan-500",
    bgColor: "bg-cyan-500/5",
    iconColor: "text-cyan-400",
    titleColor: "text-cyan-300",
    label: "Mẹo Hay",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-500/5",
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
    label: "Lưu Ý",
  },
  info: {
    icon: Info,
    borderColor: "border-l-blue-500",
    bgColor: "bg-blue-500/5",
    iconColor: "text-blue-400",
    titleColor: "text-blue-300",
    label: "Thông Tin",
  },
  important: {
    icon: Zap,
    borderColor: "border-l-violet-500",
    bgColor: "bg-violet-500/5",
    iconColor: "text-violet-400",
    titleColor: "text-violet-300",
    label: "Quan Trọng",
  },
};

interface GuideCalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function GuideCallout({ variant = "info", title, children, className }: GuideCalloutProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className={cn(
      "border-l-4 rounded-r-xl px-5 py-4 flex gap-3",
      config.borderColor,
      config.bgColor,
      className
    )}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.iconColor)} />
      <div className="text-sm leading-relaxed text-muted-foreground">
        {title && (
          <span className={cn("font-semibold mr-1.5", config.titleColor)}>{title}:</span>
        )}
        {children}
      </div>
    </div>
  );
}
