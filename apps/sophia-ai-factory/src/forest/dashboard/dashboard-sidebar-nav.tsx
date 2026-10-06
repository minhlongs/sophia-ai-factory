"use client";

/**
 * Canonical Dashboard Sidebar Navigation Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI)
 *
 * Implements the Obsidian Cyber-Glass dashboard navigation featuring:
 * 1. 14 canonical Sophia AI Factory modules (including SOPs & Challenges)
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
import { X } from "lucide-react";
import {
  SOPHIA_NAV_MODULES,
  type DashboardNavModule,
  type DashboardUserProps,
  type DashboardSidebarNavProps,
} from "./dashboard-nav-modules";
import { DashboardUserCard } from "./dashboard-user-card";
import { DashboardNavItems } from "./dashboard-nav-items";

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
          "hidden md:flex flex-col w-[280px] h-screen fixed top-0 left-0 bg-[#08090D] border-r border-[#222536] z-30 select-none",
          className
        )}
      >
        <div className="h-16 px-6 border-b border-border/70 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)]">
            S
          </div>
          <div className="min-w-0 flex-1 truncate">
            <h2 className="text-sm font-bold text-white tracking-tight truncate">Sophia AI Factory</h2>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest truncate">
              Autonomous Video
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
        <>
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
            onClick={onCloseMobile}
            data-testid="mobile-drawer-backdrop"
            aria-hidden="true"
          />
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#08090D] border-r border-[#222536] flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
              className
            )}
            data-testid="mobile-drawer"
            aria-label="Mobile navigation drawer"
          >
            <div className="h-16 px-5 border-b border-border/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  S
                </div>
                <span className="text-sm font-bold text-white truncate">Sophia AI Factory</span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-muted/60 transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
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
        </>
      )}
    </>
  );
}
