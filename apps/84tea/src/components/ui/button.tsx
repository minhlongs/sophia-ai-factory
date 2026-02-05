import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2",
  {
    variants: {
      variant: {
        filled:
          "bg-primary text-on-primary shadow-elevation-1 hover:bg-primary/90 hover:shadow-elevation-2 active:shadow-elevation-1 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
        tonal:
          "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 hover:shadow-elevation-1 active:shadow-none disabled:bg-on-surface/12 disabled:text-on-surface/38",
        outlined:
          "border border-outline bg-transparent text-primary hover:bg-primary/8 focus:border-primary active:bg-primary/12 disabled:border-on-surface/12 disabled:text-on-surface/38",
        elevated:
          "bg-surface-container-low text-primary shadow-elevation-1 hover:bg-primary/8 hover:shadow-elevation-2 active:shadow-elevation-1 active:bg-primary/12 disabled:bg-on-surface/12 disabled:text-on-surface/38 disabled:shadow-none",
        text: "bg-transparent text-primary hover:bg-primary/8 active:bg-primary/12 disabled:text-on-surface/38",
        fab: "bg-primary-container text-on-primary-container shadow-elevation-3 hover:shadow-elevation-4 active:shadow-elevation-3 hover:bg-primary-container/90 rounded-2xl",
      },
      size: {
        default: "h-10 px-6 py-2.5",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 px-0",
        fab: "h-14 w-14 p-0 text-2xl",
        "fab-sm": "h-10 w-10 p-0 text-xl rounded-xl",
      },
    },
    defaultVariants: {
      variant: "filled",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Suppress unused variable warning for asChild since we plan to implement Slot later
    void asChild;
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
