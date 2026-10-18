'use client';

import React from 'react';
import { Link } from '@/navigation';
import { Menu, X } from 'lucide-react';

export interface MarketingNavLinkItem {
  href: string;
  label: string;
}

export interface MarketingNavMobileTriggerProps {
  locale: string;
  mobileMenuOpen: boolean;
  onSwitchLocale: () => void;
  onToggleMenu: () => void;
}

export function MarketingNavMobileTrigger({
  locale,
  mobileMenuOpen,
  onSwitchLocale,
  onToggleMenu,
}: MarketingNavMobileTriggerProps) {
  return (
    <div className="flex md:hidden items-center gap-2">
      <button
        type="button"
        onClick={onSwitchLocale}
        className="p-2 rounded-lg text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] text-xs font-mono font-bold uppercase"
      >
        {locale === 'en' ? 'VI' : 'EN'}
      </button>
      <button
        type="button"
        onClick={onToggleMenu}
        className="p-2 rounded-lg text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08]"
        aria-label="Toggle mobile menu"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
}

export interface MarketingNavMobileDrawerProps {
  navLinks: MarketingNavLinkItem[];
  loginLabel: string;
  getStartedLabel: string;
  onClose: () => void;
}

export function MarketingNavMobileDrawer({
  navLinks,
  loginLabel,
  getStartedLabel,
  onClose,
}: MarketingNavMobileDrawerProps) {
  return (
    <div className="md:hidden bg-card/95 dark:bg-[#090A10]/95 border-b border-border dark:border-white/[0.08] px-6 py-6 space-y-4 backdrop-blur-2xl">
      <div className="flex flex-col space-y-2">
        {navLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="px-4 py-3 rounded-xl text-base font-medium text-foreground dark:text-slate-200 hover:text-primary dark:hover:text-white hover:bg-muted/60 dark:hover:bg-white/[0.05]"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="pt-4 border-t border-border dark:border-white/[0.08] flex flex-col gap-3">
        <Link
          href="/login"
          onClick={onClose}
          className="w-full text-center py-3 rounded-xl text-foreground dark:text-slate-200 bg-muted/60 dark:bg-white/[0.05] border border-border dark:border-white/[0.08] text-sm font-semibold"
        >
          {loginLabel}
        </Link>
        <Link
          href="/register"
          onClick={onClose}
          className="w-full text-center py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm"
        >
          {getStartedLabel}
        </Link>
      </div>
    </div>
  );
}
