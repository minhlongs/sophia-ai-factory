/**
 * Distribution Asset status transitions and validation.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/asset-transitions
 */

import type { DistributionAsset } from '@/seed/types/creative-domain';

const VALID_TRANSITIONS: Record<DistributionAsset['status'], DistributionAsset['status'][]> = {
  draft: ['scheduled', 'posting', 'failed'],
  scheduled: ['posting', 'failed'],
  posting: ['posted', 'failed'],
  posted: ['failed'],
  failed: ['scheduled'],
};

export function isValidAssetTransition(
  from: DistributionAsset['status'],
  to: DistributionAsset['status'],
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
