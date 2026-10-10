import type { D1Database } from '@/seed/db/client'
import type { SlaDegradationIncident } from '@/seed/types/gpu-mesh'
import { logger } from '@/seed/utils/logger-utility'

export async function recordMcuLedgerTransaction(
  db: D1Database,
  incident: SlaDegradationIncident,
  compensationMcu: number,
  now: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO mcu_transactions (
          id, user_id, delta, reason, metadata, created_at
        ) VALUES (
          lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5
        )`,
      )
      .bind(
        incident.orgId,
        compensationMcu,
        'SLA_DEGRADATION_COMPENSATION',
        JSON.stringify({
          incidentId: incident.id,
          reservationId: incident.reservationId,
          breachType: incident.breachType,
          measuredValue: incident.measuredValue,
          creditAmountCents: incident.creditAmountCents,
        }),
        now,
      )
      .run()
  } catch (mcuTxError) {
    logger.warn('[sla-cron] Notice: mcu_transactions log skipped', {
      error: String(mcuTxError),
    })
  }
}

export function generateRefundLedgerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `rfl_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  }
  return `rfl_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`
}
