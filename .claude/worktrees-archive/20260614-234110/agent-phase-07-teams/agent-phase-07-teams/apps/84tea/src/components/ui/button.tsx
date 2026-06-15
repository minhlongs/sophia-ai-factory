import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-6 py-2",
  {
    variants: {
      variant: {
        filled:
          "bg-primary text-on-primary hover:bg-primary/90 shadow-sm hover:shadow-md hover:elevation-1",
        tonal:
          "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 hover:shadow-sm",
        outlined:
          "border border-outline text-primary bg-transparent hover:bg-primary/10 focus:bg-primary/10",
        elevated:
          "bg-surface-variant text-primary shadow-md hover:bg-surface-variant/80 hover:shadow-lg",
        text: "bg-transparent text-primary hover:bg-primary/10",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10 px-0",
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
