'use client';
/**
 * Tier badge — small colored chip for BASIC/PREMIUM/ENTERPRISE/MASTER.
 * @module components/dashboard/mission-control/tier-badge
 */

import Link from 'next/link';
import type { Tier } from '@/seed/types';
import { TIER_CONFIG } from '@/seed/config/tiers';

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
  const label = TIER_CONFIG[tier]?.label ?? tier;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {label}
      </Link>
    );
  }
  return <span className={classes}>{label}</span>;
}
