import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full bg-transparent text-sm text-on-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-on-surface-variant/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors peer",
  {
    variants: {
      variant: {
        outlined:
          "h-14 rounded-[4px] border border-outline px-4 py-2 hover:border-on-surface focus-visible:border-2 focus-visible:border-primary focus-visible:border-t-transparent",
        filled:
          "h-14 rounded-t-[4px] border-b border-on-surface-variant bg-surface-container-highest px-4 pt-4 pb-1 hover:bg-on-surface/8 focus-visible:border-b-2 focus-visible:border-primary",
      },
    },
    defaultVariants: {
      variant: "outlined",
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        placeholder={props.placeholder || " "} // Ensure placeholder exists for peer-placeholder-shown
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input, inputVariants };
