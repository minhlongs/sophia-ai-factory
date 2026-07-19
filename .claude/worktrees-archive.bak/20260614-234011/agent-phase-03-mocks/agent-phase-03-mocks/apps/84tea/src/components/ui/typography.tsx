import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const typographyVariants = cva("text-on-surface", {
  variants: {
    variant: {
      "display-large": "font-display text-[57px] leading-[64px] tracking-[-0.25px]",
      "display-medium": "font-display text-[45px] leading-[52px] tracking-[0px]",
      "display-small": "font-display text-[36px] leading-[44px] tracking-[0px]",
      "headline-large": "font-display text-[32px] leading-[40px] tracking-[0px]",
      "headline-medium": "font-display text-[28px] leading-[36px] tracking-[0px]",
      "headline-small": "font-display text-[24px] leading-[32px] tracking-[0px]",
      "title-large": "font-body text-[22px] leading-[28px] tracking-[0px]",
      "title-medium": "font-body text-[16px] leading-[24px] tracking-[0.15px] font-medium",
      "title-small": "font-body text-[14px] leading-[20px] tracking-[0.1px] font-medium",
      "body-large": "font-body text-[16px] leading-[24px] tracking-[0.5px]",
      "body-medium": "font-body text-[14px] leading-[20px] tracking-[0.25px]",
      "body-small": "font-body text-[12px] leading-[16px] tracking-[0.4px]",
      "label-large": "font-body text-[14px] leading-[20px] tracking-[0.1px] font-medium",
      "label-medium": "font-body text-[12px] leading-[16px] tracking-[0.5px] font-medium",
      "label-small": "font-body text-[11px] leading-[16px] tracking-[0.5px] font-medium",
    },
    color: {
      default: "text-on-surface",
      primary: "text-primary",
      secondary: "text-secondary",
      tertiary: "text-tertiary",
      error: "text-error",
      "on-surface-variant": "text-on-surface-variant",
    },
  },
  defaultVariants: {
    variant: "body-large",
    color: "default",
  },
});

export interface TypographyProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "color">,
    VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, color, as, ...props }, ref) => {
    const Component = as || "p";

    // Auto-map variants to appropriate HTML tags if 'as' is not specified
    let FinalComponent = Component;
    if (!as) {
      if (variant?.startsWith("display") || variant?.startsWith("headline")) {
        FinalComponent = "h1";
      } else if (variant?.startsWith("title")) {
        FinalComponent = "h2";
      } else if (variant?.startsWith("label")) {
        FinalComponent = "span";
      }
    }

    return (
      <FinalComponent
        className={cn(typographyVariants({ variant, color, className }))}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        {...props}
      />
    );
  }
);
Typography.displayName = "Typography";

export { Typography, typographyVariants };
