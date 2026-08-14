'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, SidebarItem } from '../ui/sidebar';
import {
  LayoutDashboard,
  Package as Inventory2,
  Users as Group,
  CreditCard as Payments,
  Handshake,
  Settings,
  Search,
  Bell as Notifications,
  HelpCircle as HelpOutline,
  ArrowRight as ArrowForward, // eslint-disable-line @typescript-eslint/no-unused-vars
} from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { Input } from '../ui/input';

export interface TopAppBarProps {
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** User name */
  userName?: string;
  /** User role */
  userRole?: string;
  /** User avatar src */
  userAvatar?: string | null;
  /** Notification count */
  notificationCount?: number;
  /** Navigation items for sidebar */
  navItems?: SidebarItem[];
  /** Current pathname for active state */
  pathname?: string;
}

/**
 * Stitch-compatible TopAppBar component
 *
 * Material Design 3 top app bar with Sophia theme.
 */
export function TopAppBar({
  searchPlaceholder = 'Search data, transactions...',
  userName = 'User',
  userRole = 'Member',
  userAvatar,
  notificationCount = 0,
  navItems = [],
  pathname: providedPathname,
}: TopAppBarProps) {
  const pathnameFromHook = usePathname();
  const pathname = providedPathname || pathnameFromHook;

  const activeItems = navItems.map(item => ({ // eslint-disable-line @typescript-eslint/no-unused-vars
    ...item,
    active: pathname === item.href || pathname?.startsWith(item.href + '/'),
  }));

  return (
    <header className="h-16 fixed top-0 right-0 z-40 bg-surface-container-lowest border-b border-outline-variant flex items-center px-lg ml-[280px]">
      {/* Search */}
      <div className="flex items-center gap-md w-1/2 max-w-2xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
          <Input
            placeholder={searchPlaceholder}
            prefix={<Search className="w-5 h-5" />}
            className="pl-10 w-full max-w-md"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-lg ml-auto">
        {/* Notifications */}
        <button className="relative p-2 rounded-full hover:bg-surface-container-low transition-all">
          <Notifications className="w-5 h-5 text-on-surface-variant" />
          {notificationCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
          )}
        </button>

        {/* Help */}
        <button className="p-2 rounded-full hover:bg-surface-container-low transition-all">
          <HelpOutline className="w-5 h-5 text-on-surface-variant" />
        </button>

        {/* Divider */}
        <div className="h-8 w-[1px] bg-outline-variant mx-sm" />

        {/* User Menu */}
        <div className="flex items-center gap-sm">
          <div className="text-right">
            <p className="font-label-md text-label-md text-on-surface">{userName}</p>
            <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">
              {userRole}
            </p>
          </div>
          <Avatar
            src={userAvatar}
            alt={userName}
            initials={userName}
            size="md"
          />
        </div>
      </div>
    </header>
  );
}

TopAppBar.displayName = 'TopAppBar';

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
 * Complete Dashboard Layout with Sidebar + Header + Main Content
 */
export function DashboardLayout({
  navItems = [],
  pathname,
  user = { name: 'User', role: 'Member' },
  children,
  title,
  subtitle,
  actions,
}: DashboardLayoutProps) {
  // Default navigation items if none provided
  const defaultNavItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
    { id: 'products', label: 'Products', icon: Inventory2, href: '/products' },
    { id: 'subscribers', label: 'Subscribers', icon: Group, href: '/subscribers' },
    { id: 'payments', label: 'Payments', icon: Payments, href: '/payments' },
    { id: 'affiliates', label: 'Affiliates', icon: Handshake, href: '/affiliates' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
  ];

  const items = navItems.length > 0 ? navItems : defaultNavItems;

  return (
    <>
      <Sidebar
        items={items}
        brandName="Sophia AI"
        brandTagline="Revenue Automation"
        userSection={
          <div className="flex items-center gap-sm">
            <div className="text-right flex-1">
              <p className="font-label-md text-label-md text-on-surface">{user.name}</p>
              <p className="text-[10px] text-outline font-semibold uppercase tracking-wider">
                {user.role}
              </p>
            </div>
            <Avatar
              src={user.avatar}
              alt={user.name}
              initials={user.name}
              size="md"
            />
          </div>
        }
        upgradeCard={
          <div>
            <div className="flex items-center justify-between mb-sm">
              <span className="text-label-sm font-label-sm text-primary">Pro Plan</span>
              <span className="text-label-sm font-label-sm text-on-surface-variant">80%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: '80%' }}
              />
            </div>
            <p className="text-[11px] mt-sm text-on-surface-variant">
              Upgrade for unlimited features
            </p>
          </div>
        }
      />

      <TopAppBar
        searchPlaceholder="Search data, transactions..."
        userName={user.name}
        userRole={user.role}
        userAvatar={user.avatar}
        notificationCount={0}
        navItems={items}
        pathname={pathname}
      />

      <main id="main-content" className="ml-[280px] mt-16 p-lg max-w-container-max mx-auto">
        {(title || subtitle || actions) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-xl gap-md">
            <div>
              {title && <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">{title}</h1>}
              {subtitle && (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-sm">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </>
  );
}

DashboardLayout.displayName = 'DashboardLayout';
