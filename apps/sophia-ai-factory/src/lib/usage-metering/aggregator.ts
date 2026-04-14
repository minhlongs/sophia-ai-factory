/**
 * Usage Metering Aggregator — backward-compatibility re-export
 *
 * All functionality moved to:
 *   - usage-event-collector.ts (aggregation + CSV)
 *   - usage-rollup-engine.ts (quota + summaries)
 *   - usage-kv-sync.ts (batch ingestion)
 *
 * This file re-exports everything so existing imports continue to work.
 *
 * @module usage-metering/aggregator
 * @deprecated Import from individual modules or '@/lib/usage-metering' barrel
 */

export { QUOTA_LIMITS, checkQuota, getAggregatedSummary } from './usage-rollup-engine';
export { aggregateUsageEvents, buildHourlySummary, buildDailySummary, generateCsvRows, rowsToCsv } from './usage-event-collector';
export { batchIngestUsage } from './usage-kv-sync';
