/**
 * Niche Studio Header Component
 *
 * Displays title, architectural tier, and BYOK operational readiness badges.
 * @module components/niche-studio/niche-studio-header
 */

// i18n-namespace: nicheStudio
'use client';

import React from 'react';

interface NicheStudioHeaderProps {
  t: (key: string) => string;
}

export function NicheStudioHeader({ t }: NicheStudioHeaderProps) {
  return (
    <header className="v3-core flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border dark:border-[#1E2235] pb-5 gap-4">
      <div>
        <div className="flex items-center gap-3">
          <span className="eyebrow !mb-0 px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
            <span className="dot" aria-hidden="true" />
            {t('badge')}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {t('layer')}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white mt-1">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {t('byokReady')}
        </span>
      </div>
    </header>
  );
}
