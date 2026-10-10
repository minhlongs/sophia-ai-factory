'use client';

import { useTranslations } from 'next-intl';
import { Video, Zap, Loader2 } from 'lucide-react';
import type { WelcomeHeroProps } from './types';

export function WelcomeHero({
  agencyName,
  tier,
  started,
  onGetStarted,
}: WelcomeHeroProps) {
  const t = useTranslations('welcome');

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-blue-900/10 to-transparent pointer-events-none" />
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-10 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/20 border border-primary-500/40 text-primary-300 text-xs mb-6">
          <Video aria-hidden="true" size={12} />
          {t('tierActivated', { tier })}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          {t('greeting')}
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            {agencyName}
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
          {t('summary')}
        </p>

        <button
          onClick={onGetStarted}
          disabled={started}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-lg shadow-lg shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors transition-opacity focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none"
        >
          {started ? (
            <Loader2 aria-hidden="true" size={20} className="animate-spin" />
          ) : (
            <Zap aria-hidden="true" size={20} />
          )}
          {t('getStarted')}
        </button>
        <p className="text-xs text-muted-foreground mt-3">
          {t('singleUseHint')}
        </p>
      </div>
    </div>
  );
}
