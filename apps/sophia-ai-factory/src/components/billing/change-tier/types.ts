import type { ChangeTierTiming } from '@/app/actions/billing';
import type { Tier } from '@/seed/types';

export type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; timing: ChangeTierTiming; creditCents?: number; effectiveAt?: string }
  | { status: 'error'; message: string };

export function isDowngrade(tier: Tier, currentTier: Tier): boolean {
  const TIER_RANK: Record<Tier, number> = { BASIC: 1, PREMIUM: 2, ENTERPRISE: 3, MASTER: 4 };
  return TIER_RANK[tier] < TIER_RANK[currentTier];
}

export interface ChangeTierClientProps {
  currentTier: Tier;
}
