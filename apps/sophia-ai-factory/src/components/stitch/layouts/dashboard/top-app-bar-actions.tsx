'use client';

import React from 'react';
import {
  Bell as Notifications,
  HelpCircle as HelpOutline,
  Globe,
} from 'lucide-react';
import { Avatar } from '../../ui/avatar';
import { Link } from '@/navigation';

export interface TopAppBarActionsProps {
  isVi: boolean;
  onToggleLocale: () => void;
  notificationCount: number;
  userName: string;
  userRole: string;
  userAvatar?: string | null;
  toggleLanguageLabel: string;
  notificationsLabel: string;
  helpLabel: string;
}

export function TopAppBarActions({
  isVi,
  onToggleLocale,
  notificationCount,
  userName,
  userRole,
  userAvatar,
  toggleLanguageLabel,
  notificationsLabel,
  helpLabel,
}: TopAppBarActionsProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
      {/* Bilingual Locale Switcher */}
      <button
        type="button"
        onClick={onToggleLocale}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border border-border dark:border-white/[0.08] transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={toggleLanguageLabel}
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
        aria-label={notificationsLabel}
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
        aria-label={helpLabel}
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
  );
}
