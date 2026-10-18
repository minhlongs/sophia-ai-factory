'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { StitchRouteBanner } from '@/components/stitch/ui';
import { resolveRouteBannerCopy } from '@/tree/control-deck';

export function DashboardControlDeckBanner() {
  const copy = resolveRouteBannerCopy('dashboard', useLocale() === 'vi');
  return (
    <StitchRouteBanner
      testId="dashboard-control-deck-banner"
      innerTestId="stitch-dashboard-control-deck-banner"
      ariaLabel={copy.ariaLabel}
      badgeText={copy.badge}
      statusPillText={copy.pill}
      title={copy.title}
      description={copy.description}
      ctaHref={copy.ctaHref}
      ctaLabel={copy.ctaLabel}
      tone={copy.tone}
    />
  );
}
