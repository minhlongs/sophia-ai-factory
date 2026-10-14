/**
 * Quota Alert Module
 *
 * Barrel re-export for all quota alert functionality.
 * Maintains backward compatibility with original quota-alert-service.ts imports.
 *
 * @module alerts/quota
 */

// Types and rule evaluation
export type {
  AlertSeverity,
  AlertChannel,
  AlertThreshold,
  QuotaAlertContext,
  AlertTemplate,
  AlertConfig,
  AlertDeliveryResult,
} from '@/tree/alerts/quota/alert-rule-evaluator';

export {
  TIER_ALERT_CONFIGS,
  getAlertTemplate,
  isRateLimited,
  determineThresholdsToTrigger,
} from '@/tree/alerts/quota/alert-rule-evaluator';

// Delivery
export { triggerQuotaAlert } from '@/tree/alerts/quota/alert-delivery-service';

// Schedule management and history
export {
  checkAndTriggerAlerts,
  getUserAlertHistory,
} from '@/tree/alerts/quota/alert-schedule-manager';
