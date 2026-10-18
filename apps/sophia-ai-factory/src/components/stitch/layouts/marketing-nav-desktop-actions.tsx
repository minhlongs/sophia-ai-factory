'use client';

import React from 'react';
import { Link } from '@/navigation';
import { Globe, ArrowRight } from 'lucide-react';

export interface MarketingNavDesktopActionsProps {
  locale: string;
  loginLabel: string;
  getStartedLabel: string;
  onSwitchLocale: () => void;
}

export function MarketingNavDesktopActions({
  locale,
  loginLabel,
  getStartedLabel,
  onSwitchLocale,
}: MarketingNavDesktopActionsProps) {
  return (
    <div className="hidden md:flex items-center gap-4">
      <button
        type="button"
        onClick={onSwitchLocale}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold text-foreground dark:text-slate-300 hover:text-primary dark:hover:text-white bg-card dark:bg-[#11131F] hover:bg-muted dark:hover:bg-white/[0.08] border border-border dark:border-white/[0.08] transition-all"
        aria-label="Toggle language"
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span className="uppercase tracking-wider">{locale === 'en' ? 'VI' : 'EN'}</span>
      </button>

      <Link
        href="/login"
        className="text-sm font-semibold text-muted-foreground dark:text-slate-300 hover:text-foreground dark:hover:text-white px-3 py-2 transition-colors"
      >
        {loginLabel}
      </Link>

      <Link
        href="/register"
        className="group inline-flex items-center gap-2 text-sm font-bold text-primary-foreground px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 border border-primary/25 shadow-sm transition-all active:scale-[0.98]"
      >
        <span>{getStartedLabel}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
