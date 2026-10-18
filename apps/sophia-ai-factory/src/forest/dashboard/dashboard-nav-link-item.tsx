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

export function resolveSopCreatorLabel(t: (key: string) => string): string {
  try {
    const tr = t("sidebar.sop_creator");
    if (tr && !tr.includes("sidebar.sop_creator")) return tr;
  } catch {
    // fallback
  }
  return "SOP Creator";
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
      className={cn(
        "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group min-h-[42px]",
        active
          ? "text-foreground dark:text-white bg-primary/10 font-medium border border-primary/30"
          : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 hover:translate-x-1.5 border border-transparent",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent" />
      )}
      <IconComponent
        className={cn(
          "w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
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
