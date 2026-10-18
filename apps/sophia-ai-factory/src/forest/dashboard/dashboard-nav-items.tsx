"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { SOPHIA_NAV_MODULES } from "./dashboard-nav-modules";
import { DashboardAdminNavLinks } from "./dashboard-admin-nav-links";
import {
  DashboardNavLinkItem,
  resolveNavLabel,
  resolveSopCreatorLabel,
} from "./dashboard-nav-link-item";

export interface DashboardNavItemsProps {
  currentPath?: string;
  isAdmin?: boolean;
  isVi?: boolean;
  userTier?: string;
  onCloseMobile?: () => void;
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
        const label = resolveNavLabel(t, item);

        const navElement = (
          <DashboardNavLinkItem
            key={item.id}
            href={item.href}
            active={active}
            icon={item.icon}
            label={label}
            onClick={onCloseMobile}
          />
        );

        if (item.id === "sop_marketplace" && isMaster) {
          const creatorActive = isActive("/dashboard/sop-creator");
          const creatorLabel = resolveSopCreatorLabel(t);

          return (
            <React.Fragment key={item.id}>
              {navElement}
              <DashboardNavLinkItem
                key="sop_creator"
                href="/dashboard/sop-creator"
                active={creatorActive}
                icon={Sparkles}
                label={creatorLabel}
                onClick={onCloseMobile}
              />
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
