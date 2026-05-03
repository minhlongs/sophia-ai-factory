/**
 * Usage Metering - Public API
 *
 * Main export for usage metering functionality
 */

// Types
export type {
  AiService,
  UsageEventInput,
  UsageEventDB,
  UsageSummary,
  DailyUsage,
  ExportOptions,
  CreditRule,
} from './types';

// Constants
export {
  SERVICE_ENDPOINTS,
  CREDIT_RULES,
  TIER_RATE_MULTIPLIERS,
} from './constants';

// Context propagation
export {
  runWithUsageContext,
  getUsageContext,
  type UsageContext,
} from './context';

// Core tracking
export {
  trackUsage,
  calculateCredits,
  hashLicenseKey,
  startTimer,
  checkIdempotencyKey,
  insertUsageEvent,
  resolveExternalCustomerId,
} from './tracker';

// Idempotency utilities
export {
  generateIdempotencyKey,
  isValidIdempotencyKey,
  extractIdempotencyKey,
  buildIdempotencyHeaders,
} from './idempotency';

// Batch buffer
export {
  usageBuffer,
} from './batch-buffer';

// Debug logger
export {
  debugLogger,
  logFunctionCall,
} from './debug-logger';

// Export utilities
export {
  exportUsage,
  generateCsv,
  getUsageSummaryForPeriod,
} from './export';

// Aggregation and quota
export {
  aggregateUsageEvents,
  buildHourlySummary,
  buildDailySummary,
  checkQuota,
  generateCsvRows,
  rowsToCsv,
  getAggregatedSummary,
  QUOTA_LIMITS,
  batchIngestUsage,
} from './aggregator';

// Gateway instrumentation
export {
  emitUsageEvent,
  startGatewayTimer,
  withGatewayInstrumentation,
} from './gateway-instrumentation';

export type {
  GatewayContext,
} from './gateway-instrumentation';

// Types
export type {
  BatchUsageRecord,
  IngestionResult,
  BatchIngestionResponse,
} from './types';
