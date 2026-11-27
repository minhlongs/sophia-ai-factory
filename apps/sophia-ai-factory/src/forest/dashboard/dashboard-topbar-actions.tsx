"use client";

/**
 * Dashboard TopBar Right-Side Actions (Locale Switcher, Notifications, User Profile)
 *
 * @module forest/dashboard/dashboard-topbar-actions
 */

import React from "react";
import { Bell, Globe } from "lucide-react";
import { Link } from "@/navigation";
import { ThemeToggle } from "@/forest/components/theme-toggle";

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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card hover:bg-muted/70 border border-border hover:border-primary/30 transition-all"
        aria-label="Toggle language"
        data-testid="locale-switcher"
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span className="uppercase tracking-wider font-mono font-bold">
          {currentLocale === "vi" ? "VI" : "EN"}
        </span>
      </button>

      {/* ZEN DESIGN OS v1.0 — Dual-Theme Toggle (Dark default / Light Ivory) */}
      <ThemeToggle />

      {/* Notification Bell with Unread Badge */}
      <Link
        href="/dashboard/first-value"
        className="relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border transition-colors"
        aria-label="Notifications"
        data-testid="notification-button"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-mono font-bold text-destructive-foreground shadow-sm ring-2 ring-background"
            data-testid="unread-notification-badge"
          >
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        )}
      </Link>

      {/* Divider */}
      <div className="h-6 w-[1px] bg-border hidden sm:block" />

      {/* High-Contrast User Profile Header */}
      <Link
        href="/dashboard/settings"
        className="flex items-center gap-3 pl-1 sm:pl-2 rounded-full hover:opacity-90 transition-opacity"
        data-testid="topbar-user-profile"
      >
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-foreground leading-tight">
            {userName}
          </p>
          <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-primary-text px-1.5 py-0.2 bg-primary/10 rounded border border-primary/20">
            {userRole}
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-text border border-primary/30 flex items-center justify-center font-bold text-xs ring-1 ring-border shrink-0">
          {userInitials}
        </div>
      </Link>
    </div>
  );
}
