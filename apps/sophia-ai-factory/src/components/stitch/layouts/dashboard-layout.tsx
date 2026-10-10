'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SidebarItem } from '../ui/sidebar';
import {
  TopAppBar,
  type TopAppBarProps,
  MobileNavDrawer,
  getDefaultNavItems,
  DashboardSidebarWrapper,
} from './dashboard';

export { TopAppBar, type TopAppBarProps };

export interface DashboardLayoutProps {
  /** Navigation items */
  navItems?: SidebarItem[];
  /** Current pathname */
  pathname?: string;
  /** User info */
  user?: {
    name: string;
    role: string;
    avatar?: string | null;
  };
  /** Children (page content) */
  children: React.ReactNode;
  /** Page title (optional) */
  title?: string;
  /** Page subtitle (optional) */
  subtitle?: string;
  /** Header actions (right side) */
  actions?: React.ReactNode;
}

/**
 * Complete Obsidian Cyber-Glass Dashboard Layout with Sidebar + Header + Main Content
 */
export function DashboardLayout({
  navItems = [],
  pathname,
  user = { name: 'Sophia Founder', role: 'Owner / CEO' },
  children,
  title,
  subtitle,
  actions,
}: DashboardLayoutProps) {
  const t = useTranslations('stitch.navigation');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const items = navItems.length > 0 ? navItems : getDefaultNavItems(t);

  return (
    <div className="min-h-screen bg-[#08090D] text-foreground">
      {/* Skip to content bypass link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        {t('skipToContent')}
      </a>

      {/* Mobile Slide-Over Drawer */}
      <MobileNavDrawer
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        items={items}
      />

      {/* Desktop Sidebar */}
      <DashboardSidebarWrapper items={items} user={user} />

      {/* Fixed TopBar */}
      <TopAppBar
        searchPlaceholder={t('searchPlaceholder')}
        userName={user.name}
        userRole={user.role}
        userAvatar={user.avatar}
        notificationCount={3}
        navItems={items}
        pathname={pathname}
        onOpenMobileDrawer={() => setIsMobileOpen(true)}
      />

      {/* Main Content Area */}
      <main id="main-content" className="md:ml-[280px] ml-0 pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto min-h-screen">
        {(title || subtitle || actions) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              {title && <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

DashboardLayout.displayName = 'DashboardLayout';
