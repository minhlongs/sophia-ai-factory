'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { Sidebar, type SidebarItem } from '../../ui/sidebar';
import { Avatar } from '../../ui/avatar';
import { Link } from '@/navigation';

export interface DashboardSidebarWrapperProps {
  items: SidebarItem[];
  user: {
    name: string;
    role: string;
    avatar?: string | null;
  };
}

export function DashboardSidebarWrapper({ items, user }: DashboardSidebarWrapperProps) {
  const t = useTranslations('stitch.navigation');

  return (
    <Sidebar
      items={items}
      brandName="Sophia AI"
      brandTagline={t('brandTagline')}
      userSection={
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            src={user.avatar}
            alt={user.name}
            initials={user.name}
            size="sm"
            className="shrink-0"
          />
          <div className="text-left flex-1 min-w-0 truncate">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold truncate leading-tight mt-0.5">
              {user.role}
            </p>
          </div>
        </div>
      }
      upgradeCard={
        <div className="bg-[#12141F] border border-white/[0.08] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">{t('proPlan')}</span>
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
            className="w-full h-7 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all min-w-0 truncate focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <span>{t('upgradePlan')}</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      }
    />
  );
}

DashboardSidebarWrapper.displayName = 'DashboardSidebarWrapper';
