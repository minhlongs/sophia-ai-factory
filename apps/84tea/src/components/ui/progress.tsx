import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative overflow-hidden bg-secondary-container transition-all",
  {
    variants: {
      variant: {
        linear: "w-full rounded-full",
        circular: "rounded-full bg-transparent flex items-center justify-center",
      },
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-4",
        xl: "h-12 w-12", // Only for circular
      },
    },
    defaultVariants: {
      variant: "linear",
      size: "md",
    },
  }
);

interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, variant, size, ...props }, ref) => {

    if (variant === "circular") {
        return (
            <div
                ref={ref}
                className={cn(progressVariants({ variant, size, className }))}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                {...props}
            >
                <svg
                    className="animate-spin h-full w-full text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            </div>
        )
    }

    return (
      <div
        ref={ref}
        className={cn(progressVariants({ variant, size, className }))}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress, progressVariants };
