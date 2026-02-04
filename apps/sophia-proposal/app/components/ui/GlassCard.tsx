import React from "react";
import { cn } from "@/app/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export function GlassCard({
  children,
  className,
  hoverEffect = true,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10",
        "bg-white/5 backdrop-blur-xl shadow-xl",
        hoverEffect && "transition-all duration-500 hover:border-white/20 hover:bg-white/10 hover:shadow-neon-cyan/20 hover:-translate-y-1",
        className
      )}
      {...props}
    >
      {/* Inner Glow - Top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

      {/* Inner Glow - Bottom (Subtle) */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-30" />

      {/* Content */}
      <div className="relative z-10 p-6">
        {children}
      </div>

      {/* Radial Gradient Blob on Hover */}
      {hoverEffect && (
        <div
          className="absolute -inset-full top-0 block h-[200%] w-[200%] rotate-90 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.03),transparent_40%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
        />
      )}
    </div>
  );
}
