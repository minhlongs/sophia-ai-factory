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
} from './alert-rule-evaluator';

export {
  TIER_ALERT_CONFIGS,
  getAlertTemplate,
  isRateLimited,
  determineThresholdsToTrigger,
} from './alert-rule-evaluator';

// Delivery
export { triggerQuotaAlert } from './alert-delivery-service';

// Schedule management and history
export {
  checkAndTriggerAlerts,
  getUserAlertHistory,
} from './alert-schedule-manager';
