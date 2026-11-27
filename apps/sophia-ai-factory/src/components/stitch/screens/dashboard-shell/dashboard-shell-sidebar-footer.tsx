'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/navigation';
import { cn } from '@/seed/utils/cn';

export interface SidebarUserFooterProps {
  userName?: string;
  userEmail?: string;
}

export function SidebarUserFooter({ userName, userEmail }: SidebarUserFooterProps) {
  const t = useTranslations('stitch.dashboardShell');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const isEnglish = locale === 'en';

  function switchLocale(nextLocale: string) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div className="p-4 border-t border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-3 overflow-hidden min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {(userName ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div className="overflow-hidden min-w-0">
          <p className="text-xs font-bold text-on-surface truncate">{userName ?? 'User'}</p>
          <p className="text-[10px] text-on-surface-variant truncate">{userEmail ?? ''}</p>
        </div>
      </div>
      <div className="flex items-center bg-surface-container-high rounded p-1 mt-3">
        <button
          onClick={() => switchLocale('en')}
          className={cn(
            'px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-colors',
            isEnglish
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
          aria-label={t('header.localeEnglish')}
        >
          EN
        </button>
        <button
          onClick={() => switchLocale('vi')}
          className={cn(
            'px-2 py-0.5 text-[10px] font-bold rounded shadow-sm transition-colors',
            !isEnglish
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
          aria-label={t('header.localeVietnamese')}
        >
          VI
        </button>
      </div>

      {/* Notifications */}
      <Link
        href="/dashboard/first-value"
        className="relative inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
        aria-label={t('header.notifications')}
      >
        <Bell className="w-5 h-5" />
      </Link>
    </div>
  );
}
