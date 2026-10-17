import type { D1Database } from '@/seed/db/client'
import type { SlaDegradationIncident } from '@/seed/types/gpu-mesh'
import { recordMcuLedgerTransaction, generateRefundLedgerId } from './ledger-helpers'

export async function disburseIncidentCompensation(
  db: D1Database,
  incident: SlaDegradationIncident,
  compensationMcu: number,
  now: number,
): Promise<{
  refundLedgerId: string | null
  mcuDelta: number
  centsDelta: number
}> {
  let refundLedgerId: string | null = null
  let mcuDelta = 0
  let centsDelta = 0

  if (incident.compensationRail === 'USDT_REFUND') {
    refundLedgerId = generateRefundLedgerId()
    await db
      .prepare(
        `INSERT INTO refund_ledger (
          id, refund_request_id, user_id, purchase_id, payment_id,
          amount_cents, tier_before, tier_after, mcu_clawed_back, tx_hash, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        refundLedgerId, `req_${incident.id}`, incident.orgId, incident.reservationId,
        `pay_sla_${incident.id}`, incident.creditAmountCents, 'ENTERPRISE', 'ENTERPRISE',
        0, 'SLA_DEGRADATION', now,
      )
      .run()

    centsDelta = incident.creditAmountCents
    incident.refundLedgerId = refundLedgerId
  } else if (incident.compensationRail === 'MCU_CREDIT') {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET mcu_consumed = MAX(0, mcu_consumed - ?1), updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(compensationMcu, now, incident.reservationId)
      .run()

    await recordMcuLedgerTransaction(db, incident, compensationMcu, now)
    mcuDelta = compensationMcu
  } else {
    centsDelta = incident.creditAmountCents
  }

  return { refundLedgerId, mcuDelta, centsDelta }
}

export async function persistResolvedIncidentAndStatus(
  db: D1Database,
  incident: SlaDegradationIncident,
  refundLedgerId: string | null,
  resolutionNotes: string,
  now: number,
  windowSeconds: number,
): Promise<void> {
  const existingRow = await db
    .prepare('SELECT id FROM sla_degradation_incidents WHERE id = ?1')
    .bind(incident.id)
    .first<{ id: string }>()

  if (existingRow) {
    await db
      .prepare(
        `UPDATE sla_degradation_incidents
         SET refund_status = 'disbursed', refund_ledger_id = ?1,
             resolved_at = ?2, resolution_notes = ?3, updated_at = ?2
         WHERE id = ?4`,
      )
      .bind(refundLedgerId, now, resolutionNotes, incident.id)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO sla_degradation_incidents (
          id, reservation_id, org_id, breach_type, region,
          target_threshold, measured_value, started_at, resolved_at,
          duration_seconds, impacted_jobs_count, credit_amount_cents,
          compensation_rail, refund_status, refund_ledger_id,
          detected_by, resolution_notes, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`,
      )
      .bind(
        incident.id, incident.reservationId, incident.orgId, incident.breachType,
        incident.region, incident.targetThreshold, incident.measuredValue,
        incident.startedAt, now, incident.durationSeconds ?? windowSeconds,
        incident.impactedJobsCount, incident.creditAmountCents, incident.compensationRail,
        'disbursed', refundLedgerId, 'cron_sla_monitor', resolutionNotes, now, now,
      )
      .run()
  }

  const isSevereUptime = incident.breachType === 'uptime' && incident.measuredValue < 0.95
  const isSevereLatency = incident.breachType === 'latency_p95' && incident.measuredValue > 2500
  if (isSevereUptime || isSevereLatency) {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET status = 'degraded', updated_at = ?1
         WHERE id = ?2 AND status = 'active'`,
      )
      .bind(now, incident.reservationId)
      .run()
  }
}
