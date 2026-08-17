/**
 * Distribution OS — barrel export.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution
 */

export { DistributionError } from './errors';
export type { DistributionErrorCode } from './errors';

export {
  newDistributionPlanId,
  newDistributionAssetId,
  planRowToDomain,
  assetRowToDomain,
  planDomainToRow,
  assetDomainToRow,
} from './types';
export type { DistributionPlanRow, DistributionAssetRow } from './types';

export {
  createDistributionPlan,
  getDistributionPlan,
  listDistributionPlans,
  updateDistributionPlanStatus,
  isValidPlanTransition,
} from './plans';

export {
  createDistributionAsset,
  getDistributionAsset,
  listDistributionAssets,
  updateDistributionAssetStatus,
  markDistributionAssetFailed,
  isValidAssetTransition,
} from './assets';
