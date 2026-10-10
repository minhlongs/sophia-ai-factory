import type { D1Database } from '@/seed/db/client';
import type { EnterpriseGpuReservation, SliMeasurement, BreachType } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';
import type { JobSliRow } from './types';
import { calculateAvailability, calculateP95Latency } from './penalty-formula';

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
