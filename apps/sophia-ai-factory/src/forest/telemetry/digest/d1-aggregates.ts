/**
 * D1 Aggregate Query Functions — Weekly Metrics Digest (Facade)
 *
 * @module forest/telemetry/digest/d1-aggregates
 */

export * from '@/tree/signals/digest/aggregate-types';
export {
  querySignupStats,
  queryConversionsByTier,
  queryPaymentStats,
  queryTopByokProviders,
  queryAgentDispatches,
} from '@/tree/signals/digest/aggregate-queries';
