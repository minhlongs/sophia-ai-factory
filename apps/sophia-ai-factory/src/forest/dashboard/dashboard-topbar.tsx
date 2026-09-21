"use client";

/**
 * Obsidian Cyber-Glass TopBar Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Provides:
 * 1. Fixed header with backdrop-blur-xl and obsidian border
 * 2. Mobile drawer hamburger menu trigger (< 768px)
 * 3. Clean search input with magnifying glass icon
 * 4. Bilingual locale toggle switcher (VI/EN)
 * 5. Notification bell with unread badge counter
 * 6. High-contrast user profile display
 *
 * @module forest/dashboard/dashboard-topbar
 */

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Globe, Menu } from "lucide-react";
import { cn } from "@/seed/utils/cn";

export interface DashboardTopBarProps {
  onOpenMobileDrawer?: () => void;
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
  unreadNotificationCount = 3,
  user = {
    name: "Sophia Founder",
    email: "founder@sophia.ai",
    role: "CEO / Owner",
  },
  searchPlaceholder = "Search missions, campaigns, runbooks...",
  className,
}: DashboardTopBarProps) {
  const pathname = usePathname() || "";
  const router = useRouter();

  const isVi = pathname.startsWith("/vi");
  const currentLocale = isVi ? "vi" : "en";

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
        "fixed top-0 left-0 right-0 md:left-[280px] h-16 z-20 bg-[#08090D]/80 backdrop-blur-xl border-b border-[#222536] px-4 md:px-8 flex items-center justify-between transition-all select-none",
        className
      )}
      data-testid="dashboard-topbar"
    >
      {/* Left: Mobile Trigger & Search Input */}
      <div className="flex items-center gap-3 w-full max-w-md">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-colors shrink-0"
          aria-label="Open mobile navigation"
          data-testid="mobile-drawer-trigger"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Clean Search Input */}
        <div className="relative w-full">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-sans"
            data-testid="dashboard-search-input"
          />
        </div>
      </div>

      {/* Right: Actions, Locale Switcher, Notifications, User Menu */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Bilingual Locale Switcher (VI / EN) */}
        <button
          type="button"
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-primary/30 transition-all"
          aria-label="Toggle language"
          data-testid="locale-switcher"
        >
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="uppercase tracking-wider font-mono font-bold">
            {currentLocale === "vi" ? "VI" : "EN"}
          </span>
        </button>

        {/* Notification Bell with Unread Badge */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all"
          aria-label="Notifications"
          data-testid="notification-button"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm ring-2 ring-[#08090D]"
              data-testid="unread-notification-badge"
            >
              {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-white/[0.08] hidden sm:block" />

        {/* High-Contrast User Profile Header */}
        <div
          className="flex items-center gap-3 pl-1 sm:pl-2"
          data-testid="topbar-user-profile"
        >
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{userName}</p>
            <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.2 bg-primary/10 rounded border border-primary/20">
              {userRole}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs ring-1 ring-white/10 shrink-0">
            {userInitials}
          </div>
        </div>
      </div>
    </header>
  );
}
