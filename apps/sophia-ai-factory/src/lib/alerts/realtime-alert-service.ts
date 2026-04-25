/**
 * Real-time Alert Service — barrel re-export
 *
 * Sub-modules:
 *   realtime-alert-types.ts     — AlertType, AlertSeverity, CreateAlertParams, UserAlert, UnreadAlertCount
 *   realtime-alert-mutations.ts — createRealtimeAlert, markAlertAsRead, dismissAlert, cleanupExpiredAlerts
 *   realtime-alert-queries.ts   — getUnreadAlerts, getAlertHistory, getUnreadCount
 *   realtime-alert-triggers.ts  — triggerUsageThresholdAlert, triggerLicenseExpiringAlert, triggerWebhookFailedAlert, logViolationAndAlert
 */

export type { AlertType, AlertSeverity, CreateAlertParams, UserAlert, UnreadAlertCount } from './realtime-alert-types';
export { createRealtimeAlert, markAlertAsRead, dismissAlert, cleanupExpiredAlerts } from './realtime-alert-mutations';
export { getUnreadAlerts, getAlertHistory, getUnreadCount } from './realtime-alert-queries';
export { triggerUsageThresholdAlert, triggerLicenseExpiringAlert, triggerWebhookFailedAlert, logViolationAndAlert } from './realtime-alert-triggers';
