'use client';
/**
 * Tier badge — small colored chip for BASIC/PREMIUM/ENTERPRISE/MASTER.
 * @module components/dashboard/mission-control/tier-badge
 */

import type { Tier } from '@/types';

const TIER_COLORS: Record<Tier, string> = {
  BASIC: 'bg-slate-700 text-slate-200 border-slate-600',
  PREMIUM: 'bg-violet-900/60 text-violet-200 border-violet-700',
  ENTERPRISE: 'bg-indigo-900/60 text-indigo-200 border-indigo-700',
  MASTER: 'bg-amber-900/60 text-amber-200 border-amber-700',
};

interface TierBadgeProps {
  tier: Tier;
  href?: string;
}

export function TierBadge({ tier, href }: TierBadgeProps) {
  const classes = `inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${TIER_COLORS[tier] ?? TIER_COLORS.BASIC} cursor-default`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {tier}
      </a>
    );
  }
  return <span className={classes}>{tier}</span>;
}
