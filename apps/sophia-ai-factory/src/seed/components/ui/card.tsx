import * as React from "react"
import { cn } from '@/seed/utils/cn'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass, hover, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Saigon Factory — letterpress bordered card, no glow
        "rounded-lg border bg-card text-card-foreground",
        // Inner highlight gives the stamped/letterpress effect
        "shadow-[inset_0_1px_0_0_hsl(var(--border)),0_1px_3px_0_rgba(0,0,0,0.06)]",
        glass && [
          "bg-background/80 backdrop-blur-lg",
          "border-border",
          "text-foreground"
        ],
        hover && [
          "transition-all duration-300 motion-reduce:transition-none",
          "hover:-translate-y-0.5",
          "hover:shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.3),0_6px_20px_rgba(0,0,0,0.1)]",
          "hover:border-primary/30",
        ],
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

type CardTitleAs = 'h2' | 'h3' | 'h4' | 'div';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: CardTitleAs;
}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Comp = 'h3', ...props }, ref) => (
    <Comp
      ref={ref as React.Ref<HTMLHeadingElement>}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
