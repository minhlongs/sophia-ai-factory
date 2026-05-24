import * as React from "react";
import { cn } from '@/seed/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "basic" | "premium" | "enterprise" | "default" | "secondary" | "outline" | "destructive";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors motion-reduce:transition-none",

          // Variant styles
          {
            // Basic tier - Cyan
            "bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30":
              variant === "basic",

            // Premium tier - Purple
            "bg-[var(--neon-purple)]/10 text-[var(--neon-purple)] border border-[var(--neon-purple)]/30":
              variant === "premium",

            // Enterprise tier - Gradient
            "bg-gradient-to-r from-[var(--neon-cyan)]/10 to-[var(--neon-purple)]/10 text-white border border-[var(--neon-cyan)]/30":
              variant === "enterprise",

            // Default - Glass
            "bg-white/5 text-gray-300 border border-white/10":
              variant === "default",

            // Secondary - Gray (dark theme)
            "bg-gray-800 text-gray-200 border border-gray-700":
              variant === "secondary",

            // Outline - Transparent with border (dark theme)
            "bg-transparent text-gray-400 border border-gray-600":
              variant === "outline",

            // Destructive - Red (dark theme)
            "bg-red-900/40 text-red-300 border border-red-700":
              variant === "destructive",
          },

          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
