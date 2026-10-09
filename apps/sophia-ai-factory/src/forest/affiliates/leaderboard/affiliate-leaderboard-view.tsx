'use client';

import React, { useState } from 'react';
import type { AffiliateLeaderboardViewProps } from './types';
import { HeroBanner } from './hero-banner';
import { PodiumRankings } from './podium-rankings';
import { LeaderboardTable } from './leaderboard-table';
import { TierProgressionCards } from './tier-progression-cards';

export function AffiliateLeaderboardView({
  summary,
  initialLocale = 'vi',
}: AffiliateLeaderboardViewProps) {
  const [locale, setLocale] = useState<'en' | 'vi'>(initialLocale);
  const isVi = locale === 'vi';

  const { period, totalPrizePoolUsd, topAffiliates, updatedAt } = summary;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 text-slate-100">
      <HeroBanner
        isVi={isVi}
        locale={locale}
        setLocale={setLocale}
        period={period}
        totalPrizePoolUsd={totalPrizePoolUsd}
      />

      <PodiumRankings
        isVi={isVi}
        topAffiliates={topAffiliates}
      />

      <LeaderboardTable
        isVi={isVi}
        locale={locale}
        updatedAt={updatedAt}
        topAffiliates={topAffiliates}
      />

      <TierProgressionCards
        isVi={isVi}
      />
    </div>
  );
}

export default AffiliateLeaderboardView;
