"use client";

import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function cn(...classes: (string | undefined | null | false)[]) {
  return clsx(classes);
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-full transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none";

  const variantStyles = {
    primary: "bg-primary text-on-primary hover:bg-primary-hover",
    secondary: "bg-secondary text-on-secondary hover:bg-secondary-hover",
    outline: "border-2 border-outline text-primary hover:bg-primary/10",
  };

  const sizeStyles = {
    sm: "px-4 py-2 text-sm h-9",
    md: "px-6 py-3 text-base h-11",
    lg: "px-8 py-4 text-lg h-14",
  };

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
