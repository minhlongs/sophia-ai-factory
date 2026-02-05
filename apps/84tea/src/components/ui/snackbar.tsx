import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const snackbarVariants = cva(
  "fixed z-50 flex items-center w-full max-w-md p-4 rounded-[4px] shadow-elevation-3 transition-all duration-300 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-inverse-surface text-inverse-on-surface bottom-4 left-1/2 -translate-x-1/2 md:bottom-8",
        error: "bg-error-container text-on-error-container bottom-4 left-1/2 -translate-x-1/2 md:bottom-8",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface SnackbarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof snackbarVariants> {
  isVisible: boolean;
  message: string;
  action?: React.ReactNode;
  onDismiss?: () => void;
  autoHideDuration?: number;
}

const Snackbar = React.forwardRef<HTMLDivElement, SnackbarProps>(
  ({ className, variant, isVisible, message, action, onDismiss, autoHideDuration = 5000, ...props }, ref) => {
    React.useEffect(() => {
      if (isVisible && autoHideDuration > 0 && onDismiss) {
        const timer = setTimeout(() => {
          onDismiss();
        }, autoHideDuration);
        return () => clearTimeout(timer);
      }
    }, [isVisible, autoHideDuration, onDismiss]);

    if (!isVisible) return null;

    return (
      <div
        ref={ref}
        className={cn(snackbarVariants({ variant, className }))}
        role="alert"
        {...props}
      >
        <div className="flex-1 text-body-medium mr-2">{message}</div>
        {action && <div className="ml-auto">{action}</div>}
        {onDismiss && !action && (
          <button
            onClick={onDismiss}
            className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        )}
      </div>
    );
  }
);
Snackbar.displayName = "Snackbar";

export { Snackbar };
