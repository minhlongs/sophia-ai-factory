/**
 * Quota Alert Service — backward-compatibility re-export
 *
 * All functionality moved to ./quota/* modules.
 * This file re-exports everything so existing imports continue to work.
 *
 * @module alerts/quota-alert-service
 * @deprecated Import from '@/forest/alerts/quota/alert-rule-evaluator' or
 *             '@/forest/alerts/quota/alert-delivery-service' directly
 */

export type {
  AlertSeverity,
  AlertChannel,
  AlertThreshold,
  QuotaAlertContext,
  AlertTemplate,
  AlertConfig,
  AlertDeliveryResult,
} from './quota/alert-rule-evaluator';

export {
  TIER_ALERT_CONFIGS,
  getAlertTemplate,
  isRateLimited,
  determineThresholdsToTrigger,
} from './quota/alert-rule-evaluator';

export { triggerQuotaAlert } from './quota/alert-delivery-service';

export {
  checkAndTriggerAlerts,
  getUserAlertHistory,
} from './quota/alert-schedule-manager';
