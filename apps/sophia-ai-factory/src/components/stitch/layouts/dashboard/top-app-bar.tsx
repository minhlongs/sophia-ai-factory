'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, Menu } from 'lucide-react';
import type { SidebarItem } from '../../ui/sidebar';
import { TopAppBarActions } from './top-app-bar-actions';

export { TopAppBarActions } from './top-app-bar-actions';

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
      <TopAppBarActions
        isVi={isVi}
        onToggleLocale={toggleLocale}
        notificationCount={notificationCount}
        userName={userName}
        userRole={userRole}
        userAvatar={userAvatar}
        toggleLanguageLabel={t('toggleLanguage')}
        notificationsLabel={t('notifications')}
        helpLabel={t('help')}
      />
    </header>
  );
}

TopAppBar.displayName = 'TopAppBar';
