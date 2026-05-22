/**
 * Quota Module Exports
 *
 * Public API for quota checking and overage logging
 */

export {
  // Quota checker
  checkQuotaWithOverage,
  getEffectiveQuotaLimits,
  getQuotaStatus,
  invalidateQuotaCache,
  logOverageEvent,
  DEFAULT_CONFIG,
} from './quota-checker';

export type {
  QuotaCheckContext,
  QuotaConfig,
  EnhancedQuotaCheckResult,
} from './quota-checker';

export {
  // Overage logger
  logOverageEvent as logOverageEventBuffered,
  logOverageEventImmediate,
  getUserOverageEvents,
  getOverageSummary,
  markEventsAsBillable,
} from './overage-logger';

export type {
  OverageEventInput,
} from './overage-logger';

export { checkMissionQuota, MISSION_QUOTA_BY_TIER } from './mission-quota';
export type { MissionQuotaCheck } from './mission-quota';
