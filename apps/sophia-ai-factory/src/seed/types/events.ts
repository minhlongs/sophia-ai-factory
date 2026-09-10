/**
 * Event Schemas & Payload Types for System & Operational Alerts.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/types/events
 */

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SystemAlertPayload {
  alertId?: string;
  severity?: AlertSeverity;
  provider: string;
  failureKind: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'NETWORK' | string;
  reason?: string;
  impact?: string;
  action?: string;
  missionId?: string;
  workspaceId?: string;
  chatId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface SystemAlertTriggeredEvent {
  name: 'system/alert.triggered';
  data: SystemAlertPayload;
}
