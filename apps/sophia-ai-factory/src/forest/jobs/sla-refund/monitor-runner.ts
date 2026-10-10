import type { D1Database } from '@/seed/db/client'
import type { SlaScanSummary } from '@/seed/types/gpu-mesh'
import {
  evaluateSlaDegradation,
  calculateSlaCompensation,
} from '@/tree/sla/sla-degradation-calculator'
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator'
import { logger } from '@/seed/utils/logger-utility'
import type { SlaMonitorScanOptions } from './types'
import { processSingleIncident } from './incident-processor'

export async function runSlaRefundMonitorScan(
  db: D1Database,
  options: SlaMonitorScanOptions = {},
): Promise<SlaScanSummary> {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const dryRun = options.dryRun ?? false

  const summary: SlaScanSummary = {
    scannedReservations: 0,
    incidentsDetected: 0,
    incidentsDisbursed: 0,
    totalCompensationMcu: 0,
    totalCompensationCents: 0,
    errors: [],
  }

  try {
    const countSql = options.reservationId
      ? 'SELECT COUNT(*) as count FROM enterprise_gpu_reservations WHERE id = ?1'
      : `SELECT COUNT(*) as count FROM enterprise_gpu_reservations
         WHERE status IN ('active', 'degraded') AND active_from <= ?1 AND active_until > ?1`

    const countParam = options.reservationId ?? now
    const countQuery = await db
      .prepare(countSql)
      .bind(countParam)
      .first<{ count: number }>()

    summary.scannedReservations = countQuery?.count ?? 0

    const incidents = await evaluateSlaDegradation(db, {
      windowSeconds: options.windowSeconds,
      nowSeconds: now,
      reservationId: options.reservationId,
    })

    summary.incidentsDetected = incidents.length

    if (dryRun) {
      for (const inc of incidents) {
        const windowBoundary = now - (options.windowSeconds ?? inc.durationSeconds ?? 900)
        const existing = await db
          .prepare(
            `SELECT id FROM sla_degradation_incidents
             WHERE reservation_id = ?1
               AND breach_type = ?2
               AND (created_at >= ?3 OR started_at >= ?3)
             LIMIT 1`,
          )
          .bind(inc.reservationId, inc.breachType, windowBoundary)
          .first<{ id: string }>()

        if (existing) {
          continue
        }

        summary.totalCompensationCents += inc.creditAmountCents
        const res = await getReservationById(db, inc.reservationId)
        if (res) {
          const comp = calculateSlaCompensation(
            res,
            inc.breachType,
            inc.impactedJobsCount,
            inc.compensationRail,
          )
          summary.totalCompensationMcu += comp.compensationMcu
        }
      }
      return summary
    }

    for (const incident of incidents) {
      try {
        const { mcuDelta, centsDelta, skipped } = await processSingleIncident(
          db,
          incident,
          now,
          options.windowSeconds ?? incident.durationSeconds ?? 900,
        )
        if (!skipped) {
          summary.totalCompensationMcu += mcuDelta
          summary.totalCompensationCents += centsDelta
          summary.incidentsDisbursed++;
        }
      } catch (incidentError) {
        const errorMsg = `Failed to process incident ${incident.id}: ${String(incidentError)}`
        logger.error('[sla-cron] Incident processing error', { error: errorMsg })
        summary.errors.push(errorMsg)
      }
    }

    return summary
  } catch (scanError) {
    const errorMsg = `SLA monitor scan failed: ${String(scanError)}`
    logger.error('[sla-cron] Scan failure', { error: errorMsg })
    summary.errors.push(errorMsg)
    return summary
  }
}
