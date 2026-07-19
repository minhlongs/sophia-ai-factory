/**
 * TierGateCard — reusable server-side gating component.
 *
 * Renders children if the user's tier meets the required tier.
 * When access is denied, shows a lock card with an upsell CTA to /pricing.
 *
 * SERVER COMPONENT — uses getTranslations from next-intl/server.
 */

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { TIER_CONFIG, tierHasFeature } from '@/seed/config/tiers';
import type { Tier, FeatureFlag } from '@/seed/types';
import { Card, CardContent } from '@/seed/components/ui/card';

const TIER_RANK: Record<Tier, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

function meetsRequirement(currentTier: Tier, requiredTier: Tier): boolean {
  return TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
}

export interface TierGateCardProps {
  /** Minimum tier required to access the feature */
  requiredTier: Tier;
  /** The user's current tier */
  currentTier: Tier;
  /** Display name for the gated feature (already-translated string) */
  featureName: string;
  /** Optional: if provided, `tierHasFeature()` is also checked */
  featureFlag?: FeatureFlag;
  /** Rendered if access is granted */
  children: React.ReactNode;
}

/**
 * Async Server Component — safe to call in Next.js App Router RSC pages.
 * Must NOT be used inside Client Components; use tier check inline + raw lock UI instead.
 */
export async function TierGateCard({
  requiredTier,
  currentTier,
  featureName,
  featureFlag,
  children,
}: TierGateCardProps) {
  const tierOk = meetsRequirement(currentTier, requiredTier);
  const flagOk = featureFlag ? tierHasFeature(currentTier, featureFlag) : true;

  if (tierOk && flagOk) {
    return <>{children}</>;
  }

  const t = await getTranslations('dashboard.tierGate');
  const requiredLabel = TIER_CONFIG[requiredTier]?.label ?? requiredTier;

  return (
    <Card className="border border-border bg-card">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {featureName}
          </p>
          <h3 className="text-lg font-semibold text-foreground">
            {t('title')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('description')}
          </p>
        </div>

        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {t('upgradeCTA', { tier: requiredLabel })}
        </Link>
      </CardContent>
    </Card>
  );
}
