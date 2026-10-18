"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { DashboardUserProps } from "./dashboard-nav-modules";
import { DashboardUserCard } from "./dashboard-user-card";
import { DashboardNavItems } from "./dashboard-nav-items";

export interface DashboardMobileDrawerProps {
  rawPathname: string;
  isAdmin: boolean;
  isVi: boolean;
  userTier: string;
  user: DashboardUserProps;
  onCloseMobile?: () => void;
  className?: string;
}

export function DashboardMobileDrawer({
  rawPathname,
  isAdmin,
  isVi,
  userTier,
  user,
  onCloseMobile,
  className,
}: DashboardMobileDrawerProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        onClick={onCloseMobile}
        data-testid="mobile-drawer-backdrop"
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card dark:bg-[#090A10] border-r border-border dark:border-white/[0.08] flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
          className
        )}
        data-testid="mobile-drawer"
        aria-label="Mobile navigation drawer"
      >
        <div className="h-16 px-5 border-b border-border dark:border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center font-bold text-xs shadow-sm">
              S
            </div>
            <span className="text-sm font-bold text-foreground dark:text-white truncate">
              Sophia AI Factory
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 transition-colors"
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
  );
}
