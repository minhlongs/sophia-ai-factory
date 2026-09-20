'use client';

/**
 * Marketplace Header Hero Component
 *
 * Layer: land (pure UI component)
 *
 * @module land/marketplace/marketplace-header
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

export function MarketplaceHeader() {
  const t = useTranslations('blueprintMarketplace');

  return (
    <div className="relative overflow-hidden py-8 md:py-12 text-center">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-full max-w-4xl h-48 bg-gradient-to-r from-indigo-500/10 via-purple-500/15 to-pink-500/10 blur-3xl rounded-full" />

      <div className="relative z-10 mx-auto max-w-3xl space-y-4 px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>PROVEN VIDEO BLUEPRINTS</span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {t('title')}
        </h1>

        <p className="mx-auto max-w-2xl text-sm md:text-base text-muted-foreground leading-relaxed">
          {t('subtitle')}
        </p>
      </div>
    </div>
  );
}
