'use client';

import { useTranslations } from 'next-intl';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

interface TierPlanSelectorProps {
  currentTier: Tier;
  selectedTier: Tier | null;
  onSelectTier: (tier: Tier) => void;
  submitting: boolean;
}

const SELECTABLE_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE'];

const TIER_RANK: Record<Tier, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

export default function TierPlanSelector({
  currentTier,
  selectedTier,
  onSelectTier,
  submitting,
}: TierPlanSelectorProps) {
  const t = useTranslations('dashboard.billing.changeTier');

  function isDowngrade(tier: Tier) {
    return TIER_RANK[tier] < TIER_RANK[currentTier];
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SELECTABLE_TIERS.map((tier) => {
        const config = UNIFIED_TIERS[tier];
        const isCurrent = tier === currentTier;
        const isSelected = tier === selectedTier;
        const isDown = isDowngrade(tier);

        return (
          <button
            key={tier}
            type="button"
            onClick={() => onSelectTier(tier)}
            disabled={isCurrent || submitting}
            aria-pressed={isSelected}
            className={[
              'relative text-left rounded-xl border p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              isCurrent
                ? 'border-primary bg-primary/5 cursor-not-allowed'
                : isSelected
                ? 'border-primary ring-2 ring-primary/30 bg-primary/5 cursor-pointer'
                : 'border-border hover:border-primary/50 cursor-pointer',
              submitting ? 'opacity-50' : '',
            ].join(' ')}
          >
            {isCurrent && (
              <span className="absolute top-2 right-2 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {t('badge_current')}
              </span>
            )}
            <p className="font-semibold text-sm mb-0.5">{config.name}</p>
            <p className="text-lg font-bold">
              ${config.price}
              {config.billingType === 'monthly' && (
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              )}
            </p>
            {isDown && !isCurrent && (
              <span className="mt-2 inline-block text-xs text-amber-600 dark:text-amber-400">
                {t('badge_downgrade')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
