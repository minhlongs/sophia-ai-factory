'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, SidebarItem } from '../ui/sidebar';
import {
  LayoutDashboard,
  PlusCircle,
  Film,
  Wand2,
  Youtube,
  BookOpen,
  Share2,
  ShoppingBag,
  ShieldCheck,
  Terminal,
  Activity,
  Search,
  Bell as Notifications,
  HelpCircle as HelpOutline,
  Globe,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { Link } from '@/navigation';
import { cn } from '@/seed/utils/cn';

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
  /** On open mobile drawer */
  onOpenMobileDrawer?: () => void;
}

/**
 * Obsidian Cyber-Glass TopAppBar component
 */
export function TopAppBar({
  searchPlaceholder = 'Search missions, campaigns, runbooks...',
  userName = 'Sophia Founder',
  userRole = 'Owner / CEO',
  userAvatar,
  notificationCount = 3,
  onOpenMobileDrawer,
}: TopAppBarProps) {
  const pathname = usePathname() || '';
  const router = useRouter();

  const isVi = pathname.startsWith('/vi');
  const toggleLocale = () => {
    let newPath = pathname;
    if (isVi) {
      newPath = pathname.replace(/^\/vi/, '/en') || '/en/dashboard';
    } else if (pathname.startsWith('/en')) {
      newPath = pathname.replace(/^\/en/, '/vi') || '/vi/dashboard';
    } else {
      newPath = `/vi${pathname}`;
    }
    router.push(newPath);
  };

  return (
    <header className="h-16 fixed top-0 left-0 right-0 md:left-[280px] z-30 bg-[#08090D]/80 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-4 md:px-8">
      {/* Search & Mobile Trigger */}
      <div className="flex items-center gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-xs md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-sans"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Bilingual Locale Switcher */}
        <button
          type="button"
          onClick={toggleLocale}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all"
          aria-label="Toggle language"
        >
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="uppercase tracking-wider font-mono font-bold">
            {isVi ? 'VI' : 'EN'}
          </span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-all"
          aria-label="Notifications"
        >
          <Notifications className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm ring-2 ring-[#08090D]">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {/* Help */}
        <Link
          href="/dashboard/help"
          className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-all hidden sm:block"
          aria-label="Help"
        >
          <HelpOutline className="w-4 h-4" />
        </Link>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-white/[0.08] hidden sm:block" />

        {/* User Menu */}
        <div className="flex items-center gap-3 pl-1 sm:pl-2">
          <div className="text-right hidden sm:block min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{userName}</p>
            <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.2 bg-primary/10 rounded border border-primary/20">
              {userRole}
            </span>
          </div>
          <Avatar
            src={userAvatar}
            alt={userName}
            initials={userName}
            size="md"
            className="ring-1 ring-white/10 shrink-0"
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 11 Canonical Sophia AI modules
  const defaultNavItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'create_mission', label: 'Create Mission', icon: PlusCircle, href: '/dashboard/missions/new' },
    { id: 'missions', label: 'AI Missions', icon: Film, href: '/dashboard/missions' },
    { id: 'creative_studio', label: 'Creative Studio', icon: Wand2, href: '/dashboard/creative-economy' },
    { id: 'youtube', label: 'YouTube Automation', icon: Youtube, href: '/dashboard/youtube' },
    { id: 'playbooks', label: 'Playbooks', icon: BookOpen, href: '/dashboard/playbooks' },
    { id: 'publish_queue', label: 'Distribution Queue', icon: Share2, href: '/dashboard/publish/queue' },
    { id: 'marketplace', label: 'Creator Marketplace', icon: ShoppingBag, href: '/marketplace' },
    { id: 'handover', label: 'Handover & Acceptance', icon: ShieldCheck, href: '/dashboard/handover' },
    { id: 'runbooks', label: 'Runbooks', icon: Terminal, href: '/dashboard/docs/runbooks' },
    { id: 'system_health', label: 'System Health', icon: Activity, href: '/dashboard/system-health' },
  ];

  const items = navItems.length > 0 ? navItems : defaultNavItems;

  return (
    <div className="min-h-screen bg-[#08090D] text-foreground">
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] bg-[#08090D] border-r border-[#222536] flex flex-col h-full shadow-2xl transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
      >
        <div className="h-16 px-5 border-b border-white/[0.08] flex items-center justify-between">
          <span className="text-sm font-bold text-white">Sophia AI Factory</span>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-all"
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop Sidebar */}
      <Sidebar
        items={items}
        brandName="Sophia AI"
        brandTagline="Revenue Automation"
        userSection={
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              src={user.avatar}
              alt={user.name}
              initials={user.name}
              size="md"
              className="shrink-0"
            />
            <div className="text-left flex-1 min-w-0 truncate">
              <p className="text-xs font-semibold text-white truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold truncate leading-tight">
                {user.role}
              </p>
            </div>
          </div>
        }
        upgradeCard={
          <div className="bg-[#12141F] border border-white/[0.08] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary">Pro Plan</span>
              <span className="font-mono text-muted-foreground">80%</span>
            </div>
            <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                style={{ width: '80%' }}
              />
            </div>
            <Link
              href="/pricing"
              className="w-full h-7 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all min-w-0 truncate"
            >
              <span>Upgrade Plan</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        }
      />

      {/* Fixed TopBar */}
      <TopAppBar
        searchPlaceholder="Search missions, campaigns, runbooks..."
        userName={user.name}
        userRole={user.role}
        userAvatar={user.avatar}
        notificationCount={3}
        navItems={items}
        pathname={pathname}
        onOpenMobileDrawer={() => setIsMobileOpen(true)}
      />

      {/* Main Content Area */}
      <main id="main-content" className="md:ml-[280px] ml-0 pt-16 p-4 md:p-8 max-w-7xl mx-auto">
        {(title || subtitle || actions) && (
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              {title && <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

DashboardLayout.displayName = 'DashboardLayout';
