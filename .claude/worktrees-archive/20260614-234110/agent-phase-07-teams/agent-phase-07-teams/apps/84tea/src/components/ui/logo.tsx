import React from "react";
import { cn } from "@/lib/utils";
import { Typography } from "@/components/ui/typography";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "light" | "dark" | "color";
}

export function Logo({ className, variant = "color", ...props }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {/* Placeholder Icon - Lotus/Tea Leaf Abstract */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          variant === "light" ? "text-white" : "text-primary"
        )}
      >
        <path
          d="M16 2C16 2 10 8 10 16C10 24 16 30 16 30C16 30 22 24 22 16C22 8 16 2 16 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 30C16 30 8 26 5 16C2 6 10 6 16 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 30C16 30 24 26 27 16C30 6 22 6 16 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex flex-col">
        <Typography
          variant="headline-small"
          className={cn(
            "font-bold leading-none tracking-tight",
            variant === "light" ? "text-white" : "text-primary"
          )}
        >
          84tea
        </Typography>
      </div>
    </div>
  );
}
