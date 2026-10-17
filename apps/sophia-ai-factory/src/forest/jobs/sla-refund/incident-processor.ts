import type { D1Database } from '@/seed/db/client'
import type { SlaDegradationIncident } from '@/seed/types/gpu-mesh'
import { calculateSlaCompensation } from '@/tree/sla/sla-degradation-calculator'
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator'
import { logger } from '@/seed/utils/logger-utility'
import {
  disburseIncidentCompensation,
  persistResolvedIncidentAndStatus,
} from './incident-persistence'

export { disburseIncidentCompensation, persistResolvedIncidentAndStatus }

export async function processSingleIncident(
  db: D1Database,
  incident: SlaDegradationIncident,
  now: number,
  windowSeconds: number = 900,
): Promise<{
  mcuDelta: number
  centsDelta: number
  skipped?: boolean
  refundLedgerId?: string | null
}> {
  const windowBoundary = now - windowSeconds
  const existingWithinWindow = await db
    .prepare(
      `SELECT id FROM sla_degradation_incidents
       WHERE reservation_id = ?1
         AND breach_type = ?2
         AND (created_at >= ?3 OR started_at >= ?3)
         AND id != ?4
       LIMIT 1`,
    )
    .bind(incident.reservationId, incident.breachType, windowBoundary, incident.id)
    .first<{ id: string }>()

  if (existingWithinWindow) {
    logger.info('[sla-cron] Skipping duplicate incident within sliding window', {
      reservationId: incident.reservationId,
      breachType: incident.breachType,
      existingIncidentId: existingWithinWindow.id,
      windowBoundary,
    })
    return { mcuDelta: 0, centsDelta: 0, skipped: true, refundLedgerId: null }
  }

  const reservation = await getReservationById(db, incident.reservationId)
  const compensation = reservation
    ? calculateSlaCompensation(
        reservation,
        incident.breachType,
        incident.impactedJobsCount,
        incident.compensationRail,
      )
    : {
        creditAmountCents: incident.creditAmountCents,
        compensationMcu: Math.round(incident.creditAmountCents * 20),
      }

  const { refundLedgerId, mcuDelta, centsDelta } = await disburseIncidentCompensation(
    db,
    incident,
    compensation.compensationMcu,
    now,
  )

  const resolutionNotes =
    incident.compensationRail === 'USDT_REFUND'
      ? `Auto-refunded ${incident.creditAmountCents}¢ USDT via ledger ${refundLedgerId}`
      : `Auto-compensated ${compensation.compensationMcu} MCU credits (${incident.creditAmountCents}¢)`

  await persistResolvedIncidentAndStatus(
    db,
    incident,
    refundLedgerId,
    resolutionNotes,
    now,
    windowSeconds,
  )

  return { mcuDelta, centsDelta, refundLedgerId }
}
