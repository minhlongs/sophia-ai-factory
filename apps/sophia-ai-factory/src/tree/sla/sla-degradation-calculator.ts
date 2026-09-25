/**
 * Enterprise SLA Degradation & SLI Calculator
 *
 * Layer: tree/sla (Domain services & pure algorithms)
 *
 * Implements:
 * - 15-minute sliding window SLI evaluation
 * - P95 latency calculation against 1500ms SLA ceiling
 * - Availability evaluation against 99.9% uptime target
 * - Cascading failover and capacity starvation breach detection
 * - Dual-rail SLA compensation calculation (MCU compute credits or USDT refunds)
 *
 * @module tree/sla/sla-degradation-calculator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
  SlaDegradationIncident,
  BreachType,
  CompensationRail,
  SliMeasurement,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation, isCompensationRail } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Calculate P95 latency from an array of millisecond values (pure function)
 */
export function calculateP95Latency(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  // Cap at max valid index
  const index = Math.min(p95Index, sorted.length - 1);
  return sorted[index];
}

/**
 * Calculate availability ratio from successful and total job counts (pure function)
 */
export function calculateAvailability(successfulJobs: number, totalJobs: number): number {
  if (totalJobs <= 0) return 1.0;
  return Math.min(1.0, Math.max(0.0, successfulJobs / totalJobs));
}

/**
 * Calculate dual-rail compensation for an SLA breach (pure function)
 */
export function calculateSlaCompensation(
  reservation: EnterpriseGpuReservation,
  breachType: BreachType,
  impactedJobsCount: number,
  rail: CompensationRail = 'MCU_CREDIT',
): { creditAmountCents: number; compensationMcu: number } {
  const refundPct = reservation.slaRefundPct || GPU_MESH_SLA_CONFIG.defaultRefundPct;

  // Base compensation: % of monthly allocation
  const baseMcuCompensation = Math.round(
    reservation.mcuMonthlyAllocation * (refundPct / 100),
  );

  // Per-impacted-job bonus (e.g. 500 MCU per directly impacted job)
  const jobImpactBonusMcu = Math.max(0, impactedJobsCount) * 500;
  const totalMcu = baseMcuCompensation + jobImpactBonusMcu;

  // Contract monthly price in cents from metadata, or standard enterprise pricing:
  // Default is $0.005 per MCU (50 cents per 1,000 MCU)
  const metadataPriceCents =
    typeof reservation.metadata?.monthlyPriceCents === 'number'
      ? reservation.metadata.monthlyPriceCents
      : null;

  const estimatedMonthlyCents =
    metadataPriceCents ?? Math.round((reservation.mcuMonthlyAllocation / 1000) * 50);

  const baseCentsCompensation = Math.round(estimatedMonthlyCents * (refundPct / 100));
  const jobImpactBonusCents = Math.max(0, impactedJobsCount) * 25; // 25 cents per impacted job
  const totalCents = baseCentsCompensation + jobImpactBonusCents;

  if (rail === 'USDT_REFUND' || rail === 'INVOICE_CREDIT') {
    return {
      creditAmountCents: totalCents,
      compensationMcu: totalMcu,
    };
  }

  // Default MCU Credit rail
  return {
    creditAmountCents: totalCents,
    compensationMcu: totalMcu,
  };
}

export interface EvaluateSlaOptions {
  windowSeconds?: number;
  nowSeconds?: number;
  reservationId?: string;
}

interface JobSliRow {
  status: string;
  execution_latency_ms: number | null;
  failover_hops: number | null;
}

/**
 * Measure SLIs for a single reservation over the specified window
 */
export async function measureReservationSli(
  db: D1Database,
  reservation: EnterpriseGpuReservation,
  windowSeconds: number = GPU_MESH_SLA_CONFIG.defaultEvaluationWindowSecs,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SliMeasurement> {
  const windowStart = nowSeconds - windowSeconds;

  let rows: JobSliRow[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT status, execution_latency_ms, failover_hops
         FROM video_render_jobs
         WHERE reservation_id = ?1
           AND updated_at >= ?2
           AND updated_at <= ?3
           AND status IN ('completed', 'failed')`,
      )
      .bind(reservation.id, windowStart, nowSeconds)
      .all<JobSliRow>();

    rows = results ?? [];
  } catch (error) {
    logger.warn('[sla-calculator] Error reading render jobs for SLI evaluation', {
      reservationId: reservation.id,
      error: String(error),
    });
  }

  const totalJobs = rows.length;
  const successfulJobs = rows.filter((r) => r.status === 'completed').length;
  const failedJobs = rows.filter((r) => r.status === 'failed').length;
  const availabilityRatio = calculateAvailability(successfulJobs, totalJobs);

  const latencies = rows
    .map((r) => r.execution_latency_ms)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 0);

  const p95LatencyMs = calculateP95Latency(latencies);
  const maxLatencyMs = latencies.length > 0 ? Math.max(...latencies) : 0;
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
      : 0;

  const cascadingFailoverJobs = rows.filter(
    (r) => typeof r.failover_hops === 'number' && r.failover_hops >= 2,
  ).length;

  const breaches: Array<{
    breachType: BreachType;
    targetThreshold: number;
    measuredValue: number;
  }> = [];

  // Check 1: Availability SLI breach
  if (totalJobs > 0 && availabilityRatio < reservation.slaUptimeTarget) {
    breaches.push({
      breachType: 'uptime',
      targetThreshold: reservation.slaUptimeTarget,
      measuredValue: availabilityRatio,
    });
  }

  // Check 2: P95 Latency SLI breach
  if (latencies.length > 0 && p95LatencyMs > reservation.slaP95LatencyMs) {
    breaches.push({
      breachType: 'latency_p95',
      targetThreshold: reservation.slaP95LatencyMs,
      measuredValue: p95LatencyMs,
    });
  }

  // Check 3: Cascading failovers
  if (cascadingFailoverJobs > 0 && totalJobs > 0 && cascadingFailoverJobs / totalJobs >= 0.2) {
    breaches.push({
      breachType: 'cascading_failover',
      targetThreshold: 0.2,
      measuredValue: cascadingFailoverJobs / totalJobs,
    });
  }

  return {
    reservationId: reservation.id,
    orgId: reservation.orgId,
    region: reservation.primaryRegion,
    windowStart,
    windowEnd: nowSeconds,
    totalJobs,
    successfulJobs,
    failedJobs,
    availabilityRatio,
    p95LatencyMs,
    maxLatencyMs,
    avgLatencyMs,
    cascadingFailoverJobs,
    breaches,
  };
}

/**
 * Generate a random UUID-like incident ID
 */
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
