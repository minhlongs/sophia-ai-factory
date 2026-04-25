/**
 * Usage Aggregator Service for Billing Dashboard
 * @module billing/usage-aggregator
 */

export type { UsageSummary, OverageDetected, UsageForecast } from './usage-aggregator-types'
export { getCurrentBillingPeriod } from './usage-aggregator-types'
export { aggregateUsageForLicense } from './usage-aggregator-query'
export { detectOverageEvents, predictUsageForecast, getUsageWithForecast, calculateOverageEstimate } from './usage-aggregator-analysis'
