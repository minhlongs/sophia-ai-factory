"use client";

/**
 * Canonical Dashboard Sidebar Navigation Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI)
 *
 * Implements the Obsidian Cyber-Glass dashboard navigation featuring:
 * 1. 15 canonical Sophia AI Factory modules (including SOPs & Challenges)
 * 2. MASTER-tier conditional SOP Creator navigation item
 * 3. Active route glows and electric indigo accent indicators
 * 4. User profile card with tier badge, quota bar, and upgrade CTA
 * 5. Responsive mobile drawer navigation (< 768px viewport)
 * 6. Conditional admin operator links when isAdmin=true
 *
 * @module forest/dashboard/dashboard-sidebar-nav
 */

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/seed/utils/cn";
import {
  SOPHIA_NAV_MODULES,
  type DashboardNavModule,
  type DashboardUserProps,
  type DashboardSidebarNavProps,
} from "./dashboard-nav-modules";
import { DashboardUserCard } from "./dashboard-user-card";
import { DashboardNavItems } from "./dashboard-nav-items";
import { DashboardMobileDrawer } from "./dashboard-mobile-drawer";

export {
  SOPHIA_NAV_MODULES,
  type DashboardNavModule,
  type DashboardUserProps,
  type DashboardSidebarNavProps,
};

export function DashboardSidebarNav({
  currentPath,
  isAdmin = false,
  isVi = false,
  user = {
    name: "Sophia Founder",
    email: "founder@sophia.ai",
    tier: "PRO",
    quotaUsagePercent: 0,
    quotaUsed: 0,
    quotaTotal: 1000,
  },
  isMobileOpen = false,
  onCloseMobile,
  className,
}: DashboardSidebarNavProps) {
  const pathnameFromHook = usePathname();
  const rawPathname = currentPath || pathnameFromHook || "/dashboard";
  const userTier = (user.tier || "PRO").toUpperCase();

  return (
    <>
      {/* Desktop Persistent Sidebar (2026 240px MD3 Sticky Rail) */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 bg-[var(--md-sys-color-surface-container-lowest)] border-r border-border z-30 select-none",
          className
        )}
      >
        <div className="h-16 px-4 border-b border-border flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center font-bold shadow-sm shrink-0">
            S
          </div>
          <div className="min-w-0 flex-1 truncate">
            <h2 className="text-sm font-bold text-foreground tracking-tight truncate">Sophia AI Factory</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest truncate">
              {isVi ? "Xưởng Video AI" : "AI Video Studio"}
            </p>
          </div>
        </div>

        <DashboardNavItems
          currentPath={rawPathname}
          isAdmin={isAdmin}
          isVi={isVi}
          userTier={userTier}
          onCloseMobile={onCloseMobile}
        />
        <DashboardUserCard user={user} isVi={isVi} onCloseMobile={onCloseMobile} />
      </aside>

      {/* Mobile Drawer (< 768px) */}
      {isMobileOpen && (
        <DashboardMobileDrawer
          rawPathname={rawPathname}
          isAdmin={isAdmin}
          isVi={isVi}
          userTier={userTier}
          user={user}
          onCloseMobile={onCloseMobile}
          className={className}
        />
      )}
    </>
  );
}
