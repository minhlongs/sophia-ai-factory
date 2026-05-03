import * as React from "react";
import { cn } from "@/lib/utils";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "lg", ...props }, ref) => {
    return (
      <div
        className={cn(
          "mx-auto w-full px-4 sm:px-6 lg:px-8",

          // Size variants
          {
            "max-w-3xl": size === "sm",
            "max-w-5xl": size === "md",
            "max-w-7xl": size === "lg",
            "max-w-[1920px]": size === "xl",
          },

          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Container.displayName = "Container";

export { Container };
