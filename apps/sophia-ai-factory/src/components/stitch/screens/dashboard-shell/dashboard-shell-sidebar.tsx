'use client';

import React from 'react';
import { Search, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { cn } from '@/seed/utils/cn';
import type { NavItem } from './dashboard-shell-types';
import { MAIN_NAV, MANAGEMENT_NAV, ADMIN_NAV } from './dashboard-shell-types';
import { SidebarUserFooter } from './dashboard-shell-sidebar-footer';

export { SidebarUserFooter, type SidebarUserFooterProps } from './dashboard-shell-sidebar-footer';

/* ───────────────────────────────────────────────────────────────
 * NavLink — single sidebar item
 * ─────────────────────────────────────────────────────────────── */

export function NavLink({ item }: { item: NavItem }) {
  const t = useTranslations('stitch.dashboardShell');
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={t(`sidebar.${item.label}`)}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-sm font-medium',
        item.active
          ? 'bg-gradient-to-r from-primary/10 to-transparent border-r-2 border-primary text-primary font-semibold'
          : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <span>{t(`sidebar.${item.label}`)}</span>
    </Link>
  );
}

/* ───────────────────────────────────────────────────────────────
 * Sidebar — left navigation panel
 * ─────────────────────────────────────────────────────────────── */

export function Sidebar({
  userName,
  userEmail,
}: {
  userName?: string;
  userEmail?: string;
}) {
  const t = useTranslations('stitch.dashboardShell');

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 bg-surface-container-low border-r border-outline-variant flex flex-col z-50"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center">
          <Zap className="w-5 h-5 text-on-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface leading-tight">Sophia AI</p>
          <p className="text-[10px] text-on-surface-variant leading-tight">Factory</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
          <input
            type="text"
            placeholder={t('sidebar.searchPlaceholder')}
            className="w-full bg-surface-container-highest rounded-lg pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-8">
        <nav>
          <ul className="space-y-1">
            {MAIN_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        <nav>
          <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('sidebar.management')}
          </h3>
          <ul className="space-y-1">
            {MANAGEMENT_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin Panel */}
        <nav>
          <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40">
            {t('sidebar.adminPanel')}
          </h3>
          <ul className="space-y-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* User section */}
      <SidebarUserFooter userName={userName} userEmail={userEmail} />
    </aside>
  );
}
