/**
 * Quota Alert Service — backward-compatibility re-export
 *
 * All functionality moved to ./quota/* modules.
 * This file re-exports everything so existing imports continue to work.
 *
 * @module alerts/quota-alert-service
 * @deprecated Import from '@/lib/alerts/quota' directly
 */

export type {
  AlertSeverity,
  AlertChannel,
  AlertThreshold,
  QuotaAlertContext,
  AlertTemplate,
  AlertConfig,
  AlertDeliveryResult,
} from './quota';

export {
  TIER_ALERT_CONFIGS,
  getAlertTemplate,
  isRateLimited,
  determineThresholdsToTrigger,
  triggerQuotaAlert,
  checkAndTriggerAlerts,
  getUserAlertHistory,
} from './quota';
