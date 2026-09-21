"use client";

/**
 * Obsidian Cyber-Glass Dashboard Shell Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Orchestrates:
 * 1. Canonical DashboardSidebarNav (desktop persistent + mobile drawer)
 * 2. Obsidian TopBar with search, notifications, locale switch, and user profile
 * 3. Responsive main content wrapper with proper topbar & sidebar padding
 *
 * @module forest/dashboard/dashboard-shell
 */

import React, { useState } from "react";
import { cn } from "@/seed/utils/cn";
import { DashboardSidebarNav, type DashboardUserProps } from "./dashboard-sidebar-nav";
import { DashboardTopBar } from "./dashboard-topbar";

export interface DashboardShellProps {
  children: React.ReactNode;
  user?: DashboardUserProps;
  isAdmin?: boolean;
  isVi?: boolean;
  currentPath?: string;
  className?: string;
}

export function DashboardShell({
  children,
  user,
  isAdmin = false,
  isVi = false,
  currentPath,
  className,
}: DashboardShellProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-[#08090D] text-foreground flex", className)}>
      {/* Canonical Sidebar Navigation (Desktop & Mobile Drawer) */}
      <DashboardSidebarNav
        currentPath={currentPath}
        isAdmin={isAdmin}
        isVi={isVi}
        user={user}
        isMobileOpen={isMobileDrawerOpen}
        onCloseMobile={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-[280px] flex flex-col min-h-screen min-w-0">
        {/* Obsidian TopBar */}
        <DashboardTopBar
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          unreadNotificationCount={3}
          user={user}
        />

        {/* Page Content Viewport */}
        <main
          id="main-content"
          className="flex-1 pt-16 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;
