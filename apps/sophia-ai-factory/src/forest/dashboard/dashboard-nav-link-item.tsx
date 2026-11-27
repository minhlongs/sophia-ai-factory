"use client";

import React from "react";
import { Link } from "@/navigation";
import { cn } from "@/seed/utils/cn";
import type { DashboardNavModule } from "./dashboard-nav-modules";

export function resolveNavLabel(
  t: (key: string) => string,
  item: DashboardNavModule,
): string {
  try {
    const translated = t(item.labelKey);
    if (translated && !translated.includes(item.labelKey)) {
      return translated;
    }
  } catch {
    // fallback
  }
  return item.fallbackLabel;
}

interface DashboardNavLinkItemProps {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  onClick?: () => void;
}

export function DashboardNavLinkItem({
  href,
  active,
  icon: IconComponent,
  label,
  onClick,
}: DashboardNavLinkItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "md3-nav-pill relative flex items-center gap-3 px-4 py-2.5 group min-h-[42px] border",
        active
          ? "text-foreground dark:text-white bg-[var(--md-sys-color-primary-container)] font-semibold border-primary/35 shadow-sm"
          : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 border-transparent",
      )}
    >
      <IconComponent
        className={cn(
          "w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-white",
        )}
        aria-hidden="true"
      />
      <span className="text-xs tracking-wide truncate">{label}</span>
    </Link>
  );
}
