/**
 * Phase 4 Feature Gate — tier-based access control for Distribution OS + Commerce + Creative Economics.
 *
 * This module provides a single entry point to check if a user's tier includes a Phase 4 feature.
 * All Phase 4 Server Actions should import canUsePhase4Feature() and gate their execution.
 *
 * Feature mapping:
 * - enable_distribution_os        → Distribution OS (publishing channel adapters, distribution-registry)
 * - enable_commerce_catalog       → Commerce product catalog (create/list/update products)
 * - enable_creative_economy       → Creative Economy dashboard (summary, assets, velocity, memory, playbook)
 * - enable_investment_advisor     → Investment Advice section (ranked ROI + velocity)
 * - enable_audience_targeting     → Audience targeting engine + segments
 *
 * @module seed/config/tiers/phase4-feature-gate
 */

import { Tier, type FeatureFlag } from '@/seed/types';
import { tierHasFeature } from '@/seed/config/tiers/tier-configs';

/** Phase 4 feature flag keys (subset of FeatureFlag) */
export type Phase4Feature =
  | 'enable_distribution_os'
  | 'enable_commerce_catalog'
  | 'enable_creative_economy'
  | 'enable_investment_advisor'
  | 'enable_audience_targeting';

/** Result of a feature gate check */
export interface FeatureGateResult {
  allowed: boolean;
  requiredTier?: Tier;
  message?: string;
}

/**
 * Check if a user's tier has access to a Phase 4 feature.
 *
 * @param userTier - The user's tier (from resolveUserTier or getUserTier)
 * @param feature - The Phase 4 feature to check
 * @returns FeatureGateResult with allowed=true if access granted, or allowed=false with requiredTier/message
 */
export function canUsePhase4Feature(
  userTier: Tier,
  feature: Phase4Feature,
): FeatureGateResult {
  const hasFeature = tierHasFeature(userTier, feature as FeatureFlag);

  if (hasFeature) {
    return { allowed: true };
  }

  // Determine minimum tier that has this feature
  const tiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  const requiredTier = tiers.find((t) => tierHasFeature(t, feature as FeatureFlag));

  return {
    allowed: false,
    requiredTier,
    message: requiredTier
      ? `This feature requires ${requiredTier} tier or higher`
      : 'Feature not available in any tier',
  };
}

/**
 * Get all Phase 4 features available for a given tier.
 */
export function getPhase4FeaturesForTier(tier: Tier): Phase4Feature[] {
  const allPhase4Features: Phase4Feature[] = [
    'enable_distribution_os',
    'enable_commerce_catalog',
    'enable_creative_economy',
    'enable_investment_advisor',
    'enable_audience_targeting',
  ];

  return allPhase4Features.filter((f) => tierHasFeature(tier, f as FeatureFlag));
}

/**
 * Get the minimum tier required for a Phase 4 feature.
 */
export function getMinimumTierForPhase4Feature(feature: Phase4Feature): Tier | undefined {
  const tiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  return tiers.find((t) => tierHasFeature(t, feature as FeatureFlag));
}