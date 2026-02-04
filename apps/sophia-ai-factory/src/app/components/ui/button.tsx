import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "glow";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",

          // Size variants
          {
            "h-9 px-4 text-sm": size === "sm",
            "h-11 px-6 text-base": size === "md",
            "h-14 px-8 text-lg": size === "lg",
          },

          // Variant styles
          {
            // Primary - Neon gradient
            "bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white hover:opacity-90":
              variant === "primary",

            // Secondary - Glassmorphism
            "bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-lg text-white hover:bg-white/10":
              variant === "secondary",

            // Ghost - Transparent with hover
            "text-white hover:bg-white/5":
              variant === "ghost",

            // Glow - Neon with glow effect
            "bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-white shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:shadow-[0_0_50px_rgba(112,0,255,0.7)] hover:scale-105":
              variant === "glow",
          },

          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
