import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "basic" | "premium" | "enterprise" | "default";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all",

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
