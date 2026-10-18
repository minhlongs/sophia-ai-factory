'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { StitchRouteBanner } from '@/components/stitch/ui';
import {
  resolveRouteBannerCopy,
  type StitchRouteBannerKey,
} from '@/tree/control-deck/route-banner-specs';

export interface StitchWave2RouteBannerProps {
  readonly routeKey: StitchRouteBannerKey;
  readonly testId?: string;
  readonly defaultShowCanvas?: boolean;
  readonly className?: string;
}

export function StitchWave2RouteBanner({
  routeKey,
  testId,
  defaultShowCanvas = false,
  className = 'mb-6',
}: Readonly<StitchWave2RouteBannerProps>) {
  const isVi = useLocale() === 'vi';
  const copy = resolveRouteBannerCopy(routeKey, isVi);
  const resolvedTestId = testId ?? `stitch-wave2-route-banner-${routeKey}`;

  return (
    <StitchRouteBanner
      testId={resolvedTestId}
      innerTestId={`${resolvedTestId}-inner`}
      ariaLabel={copy.ariaLabel}
      badgeText={copy.badge}
      statusPillText={copy.pill}
      title={copy.title}
      description={copy.description}
      ctaHref={copy.ctaHref}
      ctaLabel={copy.ctaLabel}
      defaultShowCanvas={defaultShowCanvas}
      tone={copy.tone}
      className={className}
    />
  );
}
