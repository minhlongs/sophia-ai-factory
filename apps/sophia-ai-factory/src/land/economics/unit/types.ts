/**
 * Unit Economics Submodule: Types.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/types
 */

export type {
  EconomicsProviderId,
  LtvCacMetrics,
  ProviderCostItem,
  TierMarginItem,
  UnitEconomicsSummary,
} from '@/seed/types/unit-economics-types';

export interface ProviderStatsBucket {
  jobs: number;
  success: number;
  costCents: number;
  latencyTotal: number;
}
