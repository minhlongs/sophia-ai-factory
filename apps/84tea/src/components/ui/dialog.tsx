import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const dialogVariants = cva(
  "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-surface-container-high p-6 shadow-elevation-3 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-[28px] md:w-full",
  {
    variants: {
      variant: {
        default: "border-none",
        alert: "border-none max-w-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface DialogProps extends React.HTMLAttributes<HTMLDialogElement>, VariantProps<typeof dialogVariants> {
  isOpen: boolean;
  onClose: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

const Dialog = React.forwardRef<HTMLDialogElement, DialogProps>(
  ({ className, variant, isOpen, onClose, icon, title, description, actions, children, ...props }, ref) => {
    const dialogRef = React.useRef<HTMLDialogElement>(null);

    React.useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement);

    React.useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (isOpen) {
        dialog.showModal();
      } else {
        dialog.close();
      }
    }, [isOpen]);

    // Handle backdrop click to close
    const handleMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    };

    return (
      <dialog
        ref={dialogRef}
        className={cn(dialogVariants({ variant, className }), "backdrop:bg-scrim/32 backdrop:backdrop-blur-[2px]")}
        onCancel={onClose}
        onMouseDown={handleMouseDown}
        {...props}
      >
        <div className="flex flex-col gap-4">
            {icon && <div className="flex justify-center mb-2 text-secondary">{icon}</div>}

            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <h2 className="text-headline-small font-semibold leading-none tracking-tight text-on-surface">
                {title}
              </h2>
              {description && (
                <p className="text-body-medium text-on-surface-variant">
                  {description}
                </p>
              )}
            </div>

            <div className="py-2">
                {children}
            </div>

            {actions && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
                {actions}
              </div>
            )}
        </div>
      </dialog>
    );
  }
);
Dialog.displayName = "Dialog";

export { Dialog, dialogVariants };
