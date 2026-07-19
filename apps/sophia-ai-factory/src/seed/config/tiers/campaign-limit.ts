/**
 * Campaign limit helper — resolves tier-specific campaign quotas.
 *
 * Used by credit bar (billing/sidebar) and campaign creation guard.
 * Single source of truth: UNIFIED_TIERS in unified-limits.ts.
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

/** Get the max campaigns per month for a given tier. */
export function getCampaignLimit(tier: Tier): number {
  return UNIFIED_TIERS[tier]?.campaignsPerMonth ?? 10; // default to BASIC=10
}
