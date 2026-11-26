"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  groupNavModules,
  OPC_PRIMARY_NAV_GROUPS,
  OPC_REFERRAL_NAV_ITEM,
  SOPHIA_NAV_MODULES,
  type DashboardNavGroupConfig,
} from "./dashboard-nav-modules";
import { DashboardAdminNavLinks } from "./dashboard-admin-nav-links";
import {
  DashboardNavLinkItem,
  resolveNavLabel,
} from "./dashboard-nav-link-item";

export interface DashboardNavItemsProps {
  currentPath?: string;
  isAdmin?: boolean;
  isVi?: boolean;
  /** Retained for call-site compatibility; tier no longer gates any nav item. */
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

  /**
   * Bilingual primary label with a safe fallback when a key is missing. The
   * primary groups carry their own copy so a missing translation never leaves a
   * customer staring at a raw key.
   */
  const primaryLabel = (key: string, en: string, vi: string): string => {
    try {
      const translated = t(`opcNav.${key}`);
      if (translated && !translated.startsWith("opcNav.")) return translated;
    } catch {
      // fall through to the local fallback
    }
    return isVi ? vi : en;
  };

  const primaryFallbacks: Record<string, { en: string; vi: string }> = {
    today: { en: "Today · Overview", vi: "Hôm nay · Tổng Quan" },
    offers: { en: "Offers · Affiliate Hub", vi: "Offers · Affiliate Hub" },
    campaigns: { en: "Campaigns", vi: "Chiến dịch" },
    approvals: { en: "Needs approval", vi: "Cần duyệt" },
    results: { en: "Results", vi: "Kết quả" },
    connections: { en: "Connections", vi: "Kết nối" },
    referSophia: { en: "Refer Sophia", vi: "Refer Sophia" },
    moreTools: {
      en: "More tools (all deep links)",
      vi: "Công cụ khác (liên kết đầy đủ)",
    },
    referralProgramme: {
      en: "Referral programme",
      vi: "Chương trình giới thiệu",
    },
  };
  const labelFor = (key: string): string => {
    const f = primaryFallbacks[key] ?? { en: key, vi: key };
    return primaryLabel(key, f.en, f.vi);
  };

  const primaryHeading = isVi ? "Nền Tảng AI" : "Platform Navigation";
  const groupLabel = (group: DashboardNavGroupConfig): string => {
    try {
      const translated = t(group.labelKey);
      if (translated && translated !== group.labelKey && !translated.startsWith("sidebar.groups.")) {
        return translated;
      }
    } catch {
      // fall through to local fallback
    }
    return isVi ? group.fallbackLabelVi : group.fallbackLabel;
  };
  const isFreeRdMode = userTier.toUpperCase() === "R&D $0";
  const CORE_PRIMARY_IDS = new Set(["opc_results", "opc_connections"]);
  const primaryItems = OPC_PRIMARY_NAV_GROUPS.filter((g) => CORE_PRIMARY_IDS.has(g.id));
  const groupedModules = isAdmin ? groupNavModules(SOPHIA_NAV_MODULES) : [];

  return (
    <div className="space-y-1 px-3 py-2 flex-1 overflow-y-auto">
      {/* Six primary work groups: one action per job the customer came to do. */}
      <nav aria-label={primaryHeading}>
        <h2 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {primaryHeading}
        </h2>
        <ul className="space-y-1">
          {primaryItems.map((item) => (
            <li key={item.id}>
              <DashboardNavLinkItem
                href={item.href}
                active={isActive(item.href)}
                icon={item.icon}
                label={labelFor(item.labelKey.replace("opcNav.", ""))}
                onClick={onCloseMobile}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* The referral programme is hidden in $0 RaaS Internal R&D mode. */}
      {!isFreeRdMode && (
        <nav aria-label={labelFor("referralProgramme")} className="pt-3">
          <h2 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {labelFor("referralProgramme")}
          </h2>
          <ul className="space-y-1">
            <li>
              <DashboardNavLinkItem
                href={OPC_REFERRAL_NAV_ITEM.href}
                active={isActive(OPC_REFERRAL_NAV_ITEM.href)}
                icon={OPC_REFERRAL_NAV_ITEM.icon}
                label={labelFor("referSophia")}
                onClick={onCloseMobile}
              />
            </li>
          </ul>
        </nav>
      )}

      {/* Admin-only deep links so standard users never see orphaned/legacy pages. */}
      {isAdmin && groupedModules.length > 0 && (
        <details className="pt-3 group" data-testid="sidebar-more-tools">
          <summary className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            {labelFor("moreTools")}
          </summary>
          <div className="space-y-3 mt-1">
            {groupedModules.map(({ group, items }) => (
              <div key={group.id} data-testid={`nav-group-${group.id}`}>
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabel(group)}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <DashboardNavLinkItem
                        href={item.href}
                        active={isActive(item.href)}
                        icon={item.icon}
                        label={resolveNavLabel(t, item)}
                        onClick={onCloseMobile}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

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
