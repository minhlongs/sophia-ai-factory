/**
 * @module alerts
 * Barrel re-exports.
 *
 * quota-alert-service.ts is a backward-compat re-export wrapper — NOT a real module.
 * Import directly from '@/tree/alerts/quota/alert-rule-evaluator' or
 * '@/forest/alerts/quota/alert-delivery-service' instead.
 *
 * Note: AlertSeverity is exported from realtime-alert-types only.
 * quota/alert-rule-evaluator exports a different AlertSeverity ('warning'|'critical'|'info')
 * — import that explicitly if needed from '@/tree/alerts/quota/alert-rule-evaluator'.
 */
export * from '@/tree/alerts/realtime-alert-service';
export * from '@/tree/alerts/realtime-alert-types';
// quota-alert-handler module does not exist — removed
