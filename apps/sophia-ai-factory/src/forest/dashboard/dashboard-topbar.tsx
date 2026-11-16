"use client";

/**
 * Obsidian Cyber-Glass TopBar Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * @module forest/dashboard/dashboard-topbar
 */

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Menu } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import { DashboardTopBarActions } from "./dashboard-topbar-actions";

export interface DashboardTopBarProps {
  onOpenMobileDrawer?: () => void;
  onOpenCmdK?: () => void;
  unreadNotificationCount?: number;
  user?: {
    name: string;
    email?: string;
    role?: string;
    avatarUrl?: string | null;
  };
  searchPlaceholder?: string;
  className?: string;
}

export function DashboardTopBar({
  onOpenMobileDrawer,
  onOpenCmdK,
  unreadNotificationCount = 3,
  user = {
    name: "Sophia Founder",
    email: "founder@sophia.ai",
    role: "CEO / Owner",
  },
  searchPlaceholder,
  className,
}: DashboardTopBarProps) {
  const pathname = usePathname() || "";
  const router = useRouter();

  const isVi = pathname.startsWith("/vi");
  const currentLocale = isVi ? "vi" : "en";
  const resolvedSearchPlaceholder =
    searchPlaceholder ??
    (isVi
      ? "Tìm nhiệm vụ, chiến dịch, sổ tay..."
      : "Search missions, campaigns, runbooks...");
  const cmdKLabel = isVi ? "Mở bảng lệnh nhanh (⌘K)" : "Open quick command palette (⌘K)";

  const toggleLocale = () => {
    let newPath = pathname;
    if (isVi) {
      newPath = pathname.replace(/^\/vi/, "/en") || "/en/dashboard";
    } else if (pathname.startsWith("/en")) {
      newPath = pathname.replace(/^\/en/, "/vi") || "/vi/dashboard";
    } else {
      newPath = `/vi${pathname}`;
    }
    router.push(newPath);
  };

  const userName = user.name || "Sophia Founder";
  const userRole = user.role || "CEO / Owner";
  const userInitials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 md:left-[280px] h-16 z-20 bg-background/85 dark:bg-[#08090D]/80 studio-glass backdrop-blur-xl border-b border-border dark:border-[#222536] px-4 md:px-8 flex items-center justify-between transition-all select-none",
        className
      )}
      data-testid="dashboard-topbar"
    >
      {/* Left: Mobile Trigger & Search Input */}
      <div className="flex items-center gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.06] border border-transparent hover:border-border dark:hover:border-white/[0.08] transition-colors shrink-0"
          aria-label={isVi ? "Mở menu điều hướng di động" : "Open mobile navigation"}
          data-testid="mobile-drawer-trigger"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={resolvedSearchPlaceholder}
            aria-label={resolvedSearchPlaceholder}
            className="w-full pl-9 pr-14 py-1.5 text-xs md:text-sm rounded-lg bg-muted/60 dark:bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-sans"
            data-testid="dashboard-search-input"
          />
          {onOpenCmdK && (
            <button
              type="button"
              onClick={onOpenCmdK}
              aria-label={cmdKLabel}
              data-testid="dashboard-cmdk-trigger"
              className="hidden sm:inline-flex items-center justify-center gap-0.5 absolute right-1.5 top-1/2 -translate-y-1/2 min-h-6 min-w-7 px-2 py-0.5 rounded border border-border bg-card text-[10px] font-mono font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              ⌘K
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions, Locale Switcher, Notifications, User Menu */}
      <DashboardTopBarActions
        currentLocale={currentLocale}
        onToggleLocale={toggleLocale}
        unreadNotificationCount={unreadNotificationCount}
        userName={userName}
        userRole={userRole}
        userInitials={userInitials}
      />
    </header>
  );
}
