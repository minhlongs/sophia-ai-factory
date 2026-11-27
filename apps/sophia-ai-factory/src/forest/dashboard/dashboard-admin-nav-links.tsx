"use client";

import React from "react";
import { Link } from "@/navigation";
import { cn } from "@/seed/utils/cn";
import { ShieldCheck, Activity, KeyRound } from "lucide-react";

export interface DashboardAdminNavLinksProps {
  isVi: boolean;
  isActive: (href: string) => boolean;
  onCloseMobile?: () => void;
}

const ADMIN_ITEMS = [
  { href: "/admin/handover", icon: ShieldCheck, labelVi: "Handover Console", labelEn: "Handover Console", tone: "text-amber-700 dark:text-amber-300" },
  { href: "/dashboard/system-health", icon: Activity, labelVi: "Ops Dashboard", labelEn: "Ops Dashboard", tone: "text-primary" },
  { href: "/dashboard/admin/byok-rotation", icon: KeyRound, labelVi: "Xoay Vòng Khóa", labelEn: "Key Rotation", tone: "text-amber-700 dark:text-amber-300" },
] as const;

export function DashboardAdminNavLinks({
  isVi,
  isActive,
  onCloseMobile,
}: DashboardAdminNavLinksProps) {
  return (
    <nav
      aria-label={isVi ? "Bảng Quản Trị" : "Admin Console"}
      className="pt-3 mt-3 border-t border-border dark:border-white/[0.08] space-y-1"
    >
      <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300/80">
        {isVi ? "Bảng Quản Trị" : "Admin Console"}
      </div>
      {ADMIN_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onCloseMobile}
            aria-current={active ? "page" : undefined}
            className={cn(
              "md3-nav-pill relative flex items-center gap-3 px-4 py-2 text-xs border",
              active
                ? "text-foreground dark:text-white bg-[var(--md-sys-color-primary-container)] border-primary/35 font-semibold"
                : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 border-transparent",
            )}
          >
            <Icon className={cn("w-4 h-4 shrink-0", item.tone)} aria-hidden="true" />
            <span className="truncate">{isVi ? item.labelVi : item.labelEn}</span>
          </Link>
        );
      })}
    </nav>
  );
}
