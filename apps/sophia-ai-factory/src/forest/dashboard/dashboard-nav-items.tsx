"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import {
  OPC_PRIMARY_NAV_GROUPS,
  OPC_REFERRAL_NAV_ITEM,
  SOPHIA_NAV_MODULES,
} from "./dashboard-nav-modules";
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

  /** Bilingual primary label with a safe fallback when a key is missing. */
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
    workspace: { en: "Workspace", vi: "Không gian làm việc" },
    moreTools: { en: "More tools (all deep links)", vi: "Công cụ khác (liên kết đầy đủ)" },
    referralProgramme: { en: "Referral programme", vi: "Chương trình giới thiệu" },
  };
  const labelFor = (key: string): string => {
    const f = primaryFallbacks[key] ?? { en: key, vi: key };
    return primaryLabel(key, f.en, f.vi);
  };

  const isMaster = userTier.toUpperCase() === "MASTER";
  const primaryHeading = isVi ? "Nền Tảng AI" : "Platform Navigation";

  return (
    <div className="space-y-1 px-3 py-2 flex-1 overflow-y-auto">
      {/* ── Six primary work groups ─────────────────────────────────────── */}
      <nav aria-label={primaryHeading}>
        <h2 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {primaryHeading}
        </h2>
        <ul className="space-y-1">
          {OPC_PRIMARY_NAV_GROUPS.map((item) => (
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

      {/* ── Referral programme is a SEPARATE business from affiliate earnings ── */}
      <nav aria-label={labelFor("referralProgramme")} className="pt-3">
        <h2 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
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

      {/* ── All 16 historical deep links stay reachable and keyboard-accessible ── */}
      <details className="pt-3 group">
        <summary className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          {labelFor("moreTools")}
        </summary>
        <ul className="space-y-1 mt-1">
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
                  <li>{navElement}</li>
                  <li>
                    <DashboardNavLinkItem
                      href="/dashboard/sop-creator"
                      active={creatorActive}
                      icon={Sparkles}
                      label={creatorLabel}
                      onClick={onCloseMobile}
                    />
                  </li>
                </React.Fragment>
              );
            }

            return <li key={item.id}>{navElement}</li>;
          })}
        </ul>
      </details>

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
