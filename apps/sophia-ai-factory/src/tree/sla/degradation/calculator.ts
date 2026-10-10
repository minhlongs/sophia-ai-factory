import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
  SlaDegradationIncident,
  CompensationRail,
  SliMeasurement,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation, isCompensationRail } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';
import type { EvaluateSlaOptions } from './types';
import { calculateSlaCompensation } from './penalty-formula';
import { measureReservationSli } from './window-aggregator';

function generateIncidentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sdi_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `sdi_${timestamp}${randomPart}`;
}

async function fetchReservationsForEvaluation(
  db: D1Database,
  reservationId: string | undefined,
  now: number,
): Promise<EnterpriseGpuReservation[]> {
  try {
    if (reservationId) {
      const row = await db
        .prepare('SELECT * FROM enterprise_gpu_reservations WHERE id = ?1 LIMIT 1')
        .bind(reservationId)
        .first<EnterpriseGpuReservationRow>();

      return row ? [mapRowToReservation(row)] : [];
    }

    const { results } = await db
      .prepare(
        `SELECT * FROM enterprise_gpu_reservations
         WHERE status IN ('active', 'degraded')
           AND active_from <= ?1
           AND active_until > ?1`,
      )
      .bind(now)
      .all<EnterpriseGpuReservationRow>();

    return (results ?? []).map(mapRowToReservation);
  } catch (error) {
    logger.error('[sla-calculator] Error fetching active reservations', {
      error: String(error),
    });
    return [];
  }
}

function createBreachIncidents(
  reservation: EnterpriseGpuReservation,
  sli: SliMeasurement,
  windowSeconds: number,
  now: number,
): SlaDegradationIncident[] {
  const incidents: SlaDegradationIncident[] = [];

  for (const breach of sli.breaches) {
    const impactedJobsCount =
      breach.breachType === 'uptime'
        ? sli.failedJobs
        : breach.breachType === 'cascading_failover'
          ? sli.cascadingFailoverJobs
          : sli.totalJobs;

    const preferredRail =
      reservation.metadata?.preferredCompensationRail ?? reservation.metadata?.compensationRail;
    const rail: CompensationRail = isCompensationRail(preferredRail) ? preferredRail : 'MCU_CREDIT';

    const compensation = calculateSlaCompensation(
      reservation,
      breach.breachType,
      impactedJobsCount,
      rail,
    );

    incidents.push({
      id: generateIncidentId(),
      reservationId: reservation.id,
      orgId: reservation.orgId,
      breachType: breach.breachType,
      region: reservation.primaryRegion,
      targetThreshold: breach.targetThreshold,
      measuredValue: breach.measuredValue,
      startedAt: sli.windowStart,
      resolvedAt: null,
      durationSeconds: windowSeconds,
      impactedJobsCount,
      creditAmountCents: compensation.creditAmountCents,
      compensationRail: rail,
      refundStatus: 'pending',
      refundLedgerId: null,
      detectedBy: 'cron_sla_monitor',
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
    });

    logger.warn('[sla-calculator] Detected SLA degradation breach', {
      reservationId: reservation.id,
      breachType: breach.breachType,
      targetThreshold: breach.targetThreshold,
      measuredValue: breach.measuredValue,
      impactedJobsCount,
      creditAmountCents: compensation.creditAmountCents,
    });
  }

  return incidents;
}

/**
 * Evaluate SLA degradation across all active reservations or a specific reservation
 */
export async function evaluateSlaDegradation(
  db: D1Database,
  options: EvaluateSlaOptions = {},
): Promise<SlaDegradationIncident[]> {
  const windowSeconds =
    options.windowSeconds ?? GPU_MESH_SLA_CONFIG.defaultEvaluationWindowSecs;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  const reservations = await fetchReservationsForEvaluation(db, options.reservationId, now);
  const incidents: SlaDegradationIncident[] = [];

  for (const reservation of reservations) {
    const sli = await measureReservationSli(db, reservation, windowSeconds, now);
    const reservationIncidents = createBreachIncidents(reservation, sli, windowSeconds, now);
    incidents.push(...reservationIncidents);
  }

  return incidents;
}
