"use client";

/**
 * Dashboard TopBar Right-Side Actions (Locale Switcher, Notifications, User Profile)
 *
 * @module forest/dashboard/dashboard-topbar-actions
 */

import React from "react";
import { Bell, Globe } from "lucide-react";

export interface DashboardTopBarActionsProps {
  currentLocale: "vi" | "en";
  onToggleLocale: () => void;
  unreadNotificationCount: number;
  userName: string;
  userRole: string;
  userInitials: string;
}

export function DashboardTopBarActions({
  currentLocale,
  onToggleLocale,
  unreadNotificationCount,
  userName,
  userRole,
  userInitials,
}: DashboardTopBarActionsProps) {
  return (
    <div className="flex items-center gap-2 md:gap-4 shrink-0">
      {/* Bilingual Locale Switcher (VI / EN) */}
      <button
        type="button"
        onClick={onToggleLocale}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] hover:bg-muted/70 dark:hover:bg-white/[0.08] border border-border dark:border-white/[0.08] hover:border-primary/30 transition-all"
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
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.05] border border-transparent hover:border-border dark:hover:border-white/[0.08] transition-all"
        aria-label="Notifications"
        data-testid="notification-button"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-mono font-bold text-white shadow-sm ring-2 ring-background dark:ring-[#090A10]"
            data-testid="unread-notification-badge"
          >
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="h-6 w-[1px] bg-border dark:bg-white/[0.08] hidden sm:block" />

      {/* High-Contrast User Profile Header */}
      <div
        className="flex items-center gap-3 pl-1 sm:pl-2"
        data-testid="topbar-user-profile"
      >
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-foreground dark:text-white leading-tight">
            {userName}
          </p>
          <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-primary px-1.5 py-0.2 bg-primary/10 rounded border border-primary/20">
            {userRole}
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs ring-1 ring-border dark:ring-white/10 shrink-0">
          {userInitials}
        </div>
      </div>
    </div>
  );
}
