'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Search,
  Bell as Notifications,
  HelpCircle as HelpOutline,
  Globe,
  Menu,
} from 'lucide-react';
import { Avatar } from '../../ui/avatar';
import { Link } from '@/navigation';
import type { SidebarItem } from '../../ui/sidebar';

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
  searchPlaceholder,
  userName = 'Sophia Founder',
  userRole = 'Owner / CEO',
  userAvatar,
  notificationCount = 3,
  onOpenMobileDrawer,
}: TopAppBarProps) {
  const t = useTranslations('stitch.navigation');
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

  const resolvedSearchPlaceholder = searchPlaceholder || t('searchPlaceholder');

  return (
    <header className="h-16 fixed top-0 left-0 right-0 md:left-[280px] z-30 bg-[#08090D]/80 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between px-4 md:px-8">
      {/* Search & Mobile Trigger */}
      <div className="flex items-center gap-3 w-full max-w-md">
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t('openMobileNav')}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-xs md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={resolvedSearchPlaceholder}
            className="w-full h-10 pl-9 pr-4 text-xs md:text-sm rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-border dark:border-white/[0.08] text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/60 transition-all font-sans"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Bilingual Locale Switcher */}
        <button
          type="button"
          onClick={toggleLocale}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border border-border dark:border-white/[0.08] transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t('toggleLanguage')}
        >
          <Globe className="w-3.5 h-3.5 text-primary" />
          <span className="uppercase tracking-wider font-mono font-bold">
            {isVi ? 'VI' : 'EN'}
          </span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center relative rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t('notifications')}
        >
          <Notifications className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm ring-2 ring-[#08090D]">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {/* Help */}
        <Link
          href="/dashboard/docs/runbooks"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all hidden sm:flex focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t('help')}
        >
          <HelpOutline className="w-4 h-4" />
        </Link>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-border dark:bg-white/[0.08] hidden sm:block" />

        {/* User Menu */}
        <div className="flex items-center gap-3 pl-1 sm:pl-2 shrink-0">
          <div className="text-right hidden sm:block min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{userName}</p>
            <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20 mt-0.5">
              {userRole}
            </span>
          </div>
          <Avatar
            src={userAvatar}
            alt={userName}
            initials={userName}
            size="sm"
            className="ring-1 ring-white/10 shrink-0"
          />
        </div>
      </div>
    </header>
  );
}

TopAppBar.displayName = 'TopAppBar';
