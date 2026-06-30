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

          // Variant styles — Saigon Factory palette
          {
            // Basic tier — warm amber gold
            "bg-primary/10 text-primary border border-primary/30":
              variant === "basic",

            // Premium tier — deep indigo
            "bg-accent/10 text-accent-foreground border border-accent/30":
              variant === "premium",

            // Enterprise tier — amber→indigo gradient (factory gold + ink)
            "bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 text-primary-foreground border border-primary/30":
              variant === "enterprise",

            // Default — warm paper
            "bg-muted text-muted-foreground border border-border":
              variant === "default",

            // Secondary — muted indigo
            "bg-accent/5 text-muted-foreground border border-border":
              variant === "secondary",

            // Outline — transparent with border
            "bg-transparent text-muted-foreground border border-border":
              variant === "outline",

            // Destructive — red ochre
            "bg-destructive/10 text-destructive border border-destructive/20":
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
