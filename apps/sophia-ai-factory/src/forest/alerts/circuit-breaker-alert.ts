/**
 * Circuit Breaker Alert — fires when a provider circuit trips to OPEN.
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/circuit-breaker-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

/**
 * Fire a platform alert when a provider circuit breaker transitions to OPEN.
 * Recipient = synthetic-monitor user (platform-level, not tenant-specific).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export async function triggerCircuitBreakerOpenAlert(params: {
  service: string;
  keyRef: string;
  failureCount: number;
  state: string;
}): Promise<string | null> {
  try {
    return await createRealtimeAlert({
      userId: SYNTHETIC_USER_ID,
      licenseNonce: '',
      type: 'platform.circuit_breaker',
      severity: 'high',
      title: `Circuit OPEN — ${params.service}`,
      message: `Provider ${params.service} circuit opened after ${params.failureCount} failures (keyRef=${params.keyRef.slice(0, 8)}).`,
      metadata: {
        service: params.service,
        keyRef: params.keyRef,
        failureCount: params.failureCount,
        state: params.state,
        reason: 'CIRCUIT_TRIP',
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    logger.error('[circuit-breaker-alert] dispatch failed', {
      service: params.service,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
