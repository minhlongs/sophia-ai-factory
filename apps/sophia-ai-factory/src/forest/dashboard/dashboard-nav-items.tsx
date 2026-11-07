"use client";

import { useTranslations } from "next-intl";
import { groupNavModules } from "./dashboard-nav-modules";
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

  const groupedSections = groupNavModules();

  return (
    <div className="space-y-3 px-3 py-2 flex-1 overflow-y-auto">
      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {isVi ? "Nền Tảng AI" : "Platform Navigation"}
      </div>

      {groupedSections.map(({ group, items }) => {
        const groupHeading = isVi ? group.fallbackLabelVi : group.fallbackLabelEn;

        if (group.collapsible) {
          return (
            <details
              key={group.id}
              open
              data-testid={`nav-group-${group.id}`}
              className="pt-2 border-t border-border/50 dark:border-white/[0.06]"
            >
              <summary className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 cursor-pointer select-none">
                {groupHeading}
              </summary>
              <div className="space-y-1 mt-1">
                {items.map((item) => (
                  <DashboardNavLinkItem
                    key={item.id}
                    href={item.href}
                    active={isActive(item.href)}
                    icon={item.icon}
                    label={resolveNavLabel(t, item)}
                    onClick={onCloseMobile}
                  />
                ))}
              </div>
            </details>
          );
        }

        return (
          <div key={group.id} data-testid={`nav-group-${group.id}`} className="space-y-1">
            <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {groupHeading}
            </div>
            {items.map((item) => (
              <DashboardNavLinkItem
                key={item.id}
                href={item.href}
                active={isActive(item.href)}
                icon={item.icon}
                label={resolveNavLabel(t, item)}
                onClick={onCloseMobile}
              />
            ))}
          </div>
        );
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
