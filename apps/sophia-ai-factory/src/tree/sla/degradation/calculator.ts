import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  SlaDegradationIncident,
  CompensationRail,
  SliMeasurement,
} from '@/seed/types/gpu-mesh';
import { isCompensationRail } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';
import type { EvaluateSlaOptions } from './types';
import { calculateSlaCompensation } from './penalty-formula';
import { measureReservationSli } from './window-aggregator';
import {
  generateIncidentId,
  fetchReservationsForEvaluation,
} from './reservation-fetcher';

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
