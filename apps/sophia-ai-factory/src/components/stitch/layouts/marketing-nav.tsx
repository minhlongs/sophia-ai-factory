'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname, Link } from '@/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import {
  MarketingNavMobileTrigger,
  MarketingNavMobileDrawer,
  type MarketingNavLinkItem,
  type MarketingNavMobileTriggerProps,
  type MarketingNavMobileDrawerProps,
} from './marketing-nav-mobile-drawer';
import {
  MarketingNavDesktopActions,
  type MarketingNavDesktopActionsProps,
} from './marketing-nav-desktop-actions';

export {
  MarketingNavMobileTrigger,
  MarketingNavMobileDrawer,
  MarketingNavDesktopActions,
  type MarketingNavLinkItem,
  type MarketingNavMobileTriggerProps,
  type MarketingNavMobileDrawerProps,
  type MarketingNavDesktopActionsProps,
};

export interface MarketingNavProps {
  className?: string;
}

export function MarketingNav({ className }: MarketingNavProps) {
  const t = useTranslations('landing.nav');
  const tStitch = useTranslations('stitch.landing');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const switchLocale = () => {
    const nextLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  const navLinks: MarketingNavLinkItem[] = [
    { href: '/features', label: t('features') },
    { href: '/pricing', label: t('pricing') },
    { href: '/guide', label: t('guide') },
    { href: '/affiliates', label: t('affiliates') },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        'bg-background/85 dark:bg-[#090A10]/85 studio-glass backdrop-blur-xl border-b border-border dark:border-white/[0.08]',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground border border-primary/25 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-foreground dark:text-white flex items-center gap-1.5">
              Sophia
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/25">
                AI Factory
              </span>
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 bg-muted/60 dark:bg-[#11131F]/90 border border-border dark:border-white/[0.08] rounded-full px-4 py-1.5 backdrop-blur-md">
          {navLinks.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-white hover:bg-background/80 dark:hover:bg-white/[0.06]'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <MarketingNavDesktopActions
          locale={locale}
          loginLabel={t('login')}
          getStartedLabel={tStitch('nav.getStarted')}
          onSwitchLocale={switchLocale}
        />

        <MarketingNavMobileTrigger
          locale={locale}
          mobileMenuOpen={mobileMenuOpen}
          onSwitchLocale={switchLocale}
          onToggleMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
      </div>

      {mobileMenuOpen && (
        <MarketingNavMobileDrawer
          navLinks={navLinks}
          loginLabel={t('login')}
          getStartedLabel={tStitch('nav.getStarted')}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
