/**
 * config/tiers — single source of truth for all tier definitions.
 *
 * Re-exports from:
 * - unified-limits.ts  → UnifiedTierLimits, UNIFIED_TIERS, getMcuMonthlyLimit, etc.
 * - tier-configs.ts    → TIER_CONFIGS, getTierConfig, tierHasFeature, getAllTiers
 */

export type { UnifiedTierLimits } from './unified-limits';
export {
  UNIFIED_TIERS,
  getUnifiedTierLimits,
  getMcuMonthlyLimit,
  getAiCommandLimit,
} from './unified-limits';

export {
  TIER_CONFIGS,
  getTierConfig,
  tierHasFeature,
  getAllTiers,
  TIER_CONFIG,
  DB_TIER_MAPPING,
  TIER_DB_MAPPING,
} from './tier-configs';
