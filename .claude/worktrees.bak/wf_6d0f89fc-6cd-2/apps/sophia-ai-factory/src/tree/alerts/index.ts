/**
 * @module alerts
 * Barrel re-exports.
 *
 * quota-alert-service.ts is a backward-compat re-export wrapper — NOT a real module.
 * See the forest/alerts/quota module for the implementation.
 *
 * Note: AlertSeverity is exported from realtime-alert-types only.
 * quota/alert-rule-evaluator exports a different AlertSeverity ('warning'|'critical'|'info')
 * — import that explicitly from forest/alerts/quota/alert-rule-evaluator if needed.
 */
export * from './realtime-alert-service';
export * from './realtime-alert-types';
// quota-alert-handler module does not exist — removed
