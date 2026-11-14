import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from '@/seed/utils/cn'

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white shadow hover:bg-primary/90 dark:hover:bg-primary-500",
        destructive:
          "bg-destructive text-destructive-foreground dark:bg-rose-700 dark:text-white shadow-sm hover:bg-destructive/90 dark:hover:bg-rose-600",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground dark:bg-secondary-700 dark:text-white shadow-sm hover:bg-secondary/80 dark:hover:bg-violet-600",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary-text underline-offset-4 hover:underline",
        primary: "bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white shadow-[inset_0_1px_0_0_color-mix(in_srgb,_var(--primary-foreground)_20%,_transparent),0_2px_8px_rgba(0,0,0,0.15)] hover:bg-primary/90 dark:hover:bg-primary-500 active:scale-[0.98] border-0",
        glow: "bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white shadow-[0_0_20px_color-mix(in_srgb,_var(--primary)_40%,_transparent)] hover:shadow-[0_0_35px_color-mix(in_srgb,_var(--primary)_60%,_transparent)] hover:scale-105 active:scale-[0.98] border-0 transition-all",
        glass: "bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-lg text-foreground hover:bg-muted",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
        md: "h-11 px-6 text-base",
        xl: "h-14 px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
