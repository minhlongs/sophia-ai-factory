import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  bordered?: boolean;
}

export function GlassCard({
  children,
  className,
  hover = false,
  bordered = true,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-6",
        "bg-[var(--glass-bg)] backdrop-blur-xl",
        bordered && "border border-[var(--glass-border)]",
        "shadow-lg shadow-black/5 dark:shadow-black/20",
        hover && "transition-all duration-300 hover:bg-background/20 hover:border-border/50 hover:shadow-xl hover:shadow-neon-cyan/10",
        className
      )}
    >
      {children}
    </div>
  );
}
