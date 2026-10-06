"use client";

import React from "react";
import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import { Sparkles } from "lucide-react";
import {
  SOPHIA_NAV_MODULES,
  type DashboardNavModule,
} from "./dashboard-nav-modules";
import { DashboardAdminNavLinks } from "./dashboard-admin-nav-links";

export interface DashboardNavItemsProps {
  currentPath?: string;
  isAdmin?: boolean;
  isVi?: boolean;
  userTier?: string;
  onCloseMobile?: () => void;
}

function resolveLabel(t: (key: string) => string, item: DashboardNavModule): string {
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

function resolveSopCreatorLabel(t: (key: string) => string): string {
  try {
    const tr = t("sidebar.sop_creator");
    if (tr && !tr.includes("sidebar.sop_creator")) return tr;
  } catch {
    // fallback
  }
  return "SOP Creator";
}

export function DashboardNavItems({
  currentPath = "/dashboard",
  isAdmin = false,
  isVi = false,
  userTier = "PRO",
  onCloseMobile,
}: DashboardNavItemsProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("dashboard");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const isActive = (href: string) => {
    const cleanPath = currentPath.replace(/^\/(en|vi)/, "") || "/";
    const cleanHref = href.replace(/^\/(en|vi)/, "") || "/";

    if (cleanHref === "/dashboard") {
      return cleanPath === "/dashboard";
    }
    return cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);
  };

  const isMaster = userTier.toUpperCase() === "MASTER";

  return (
    <div className="space-y-1 px-3 py-2 flex-1 overflow-y-auto">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {isVi ? "Nền Tảng AI" : "Platform Navigation"}
      </div>

      {SOPHIA_NAV_MODULES.map((item) => {
        const active = isActive(item.href);
        const IconComponent = item.icon;
        const label = resolveLabel(t, item);

        const navElement = (
          <Link
            key={item.id}
            href={item.href}
            onClick={onCloseMobile}
            className={cn(
              "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group min-h-[42px]",
              active
                ? "text-white bg-primary/10 font-medium border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                : "text-muted-foreground hover:text-white hover:bg-muted/60 hover:translate-x-1.5 border border-transparent"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent shadow-[0_0_8px_hsl(var(--primary))]" />
            )}
            <IconComponent
              className={cn(
                "w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
                active ? "text-primary" : "text-muted-foreground group-hover:text-white"
              )}
              aria-hidden="true"
            />
            <span className="text-xs tracking-wide truncate">{label}</span>
          </Link>
        );

        if (item.id === "sop_marketplace" && isMaster) {
          const creatorActive = isActive("/dashboard/sop-creator");
          const creatorLabel = resolveSopCreatorLabel(t);

          return (
            <React.Fragment key={item.id}>
              {navElement}
              <Link
                key="sop_creator"
                href="/dashboard/sop-creator"
                onClick={onCloseMobile}
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-300 group min-h-[42px]",
                  creatorActive
                    ? "text-white bg-primary/10 font-medium border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                    : "text-muted-foreground hover:text-white hover:bg-muted/60 hover:translate-x-1.5 border border-transparent"
                )}
              >
                {creatorActive && (
                  <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
                <Sparkles
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110",
                    creatorActive ? "text-primary" : "text-muted-foreground group-hover:text-white"
                  )}
                  aria-hidden="true"
                />
                <span className="text-xs tracking-wide truncate">{creatorLabel}</span>
              </Link>
            </React.Fragment>
          );
        }

        return navElement;
      })}

      {isAdmin && (
        <DashboardAdminNavLinks
          isVi={isVi}
          isActive={isActive}
          onCloseMobile={onCloseMobile}
        />
      )}
    </div>
  );
}
