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
import { Compass, Zap } from "lucide-react";
import { Link } from "@/navigation";
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
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col w-[280px] h-screen fixed top-0 left-0 bg-card dark:bg-[#090A10] border-r border-border dark:border-white/[0.08] z-30 select-none",
          className
        )}
      >
        <div className="h-16 px-6 border-b border-border dark:border-white/[0.08] flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center font-bold shadow-sm">
            S
          </div>
          <div className="min-w-0 flex-1 truncate">
            <h2 className="text-sm font-bold text-foreground dark:text-white tracking-tight truncate">Sophia AI Factory</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest truncate">
              Autonomous Video
            </p>
          </div>
        </div>

        <div className="px-3 pt-3 pb-1 flex flex-col gap-1.5 border-b border-border/60 dark:border-white/[0.06]">
          <Link
            href="/dashboard/first-value"
            className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {isVi ? "Affiliate Studio (4 Bước)" : "Affiliate Studio (4 Steps)"}
            </span>
          </Link>
          <Link
            href="/guide"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Compass className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {isVi ? "Hướng dẫn 5 phút" : "5-Min Quickstart Guide"}
            </span>
          </Link>
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
