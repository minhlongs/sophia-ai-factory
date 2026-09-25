/**
 * Enterprise SLA Degradation & Refund Monitor Cron Job
 *
 * Layer: forest/jobs (Cross-cutting orchestration & scheduled background jobs)
 *
 * Implements:
 * - Periodic scanning of active enterprise GPU reservations
 * - Automated detection of SLA breaches (uptime, latency P95, cascading failovers)
 * - Incident recording in sla_degradation_incidents table
 * - Automated dual-rail compensation disbursement (instant MCU credit top-up or USDT refund ledger entry)
 * - Health degradation status updates for enterprise reservations
 *
 * @module forest/jobs/sla-refund-monitor-cron
 */

import type { D1Database } from '@/seed/db/client';
import type { SlaScanSummary, SlaDegradationIncident } from '@/seed/types/gpu-mesh';
import {
  evaluateSlaDegradation,
  calculateSlaCompensation,
} from '@/tree/sla/sla-degradation-calculator';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import { logger } from '@/seed/utils/logger-utility';

export interface SlaMonitorScanOptions {
  windowSeconds?: number;
  dryRun?: boolean;
  nowSeconds?: number;
  reservationId?: string;
}

async function recordMcuLedgerTransaction(
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
      .run();
  } catch (mcuTxError) {
    logger.warn('[sla-cron] Notice: mcu_transactions log skipped', {
      error: String(mcuTxError),
    });
  }
}

function generateRefundLedgerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `rfl_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `rfl_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
}

export async function processSingleIncident(
  db: D1Database,
  incident: SlaDegradationIncident,
  now: number,
  windowSeconds: number = 900,
): Promise<{ mcuDelta: number; centsDelta: number; skipped?: boolean; refundLedgerId?: string | null }> {
  // 1. Sliding window deduplication check:
  // Before inserting an incident, check if an incident for reservation_id and breach_type was already recorded within now - windowSeconds
  const windowBoundary = now - windowSeconds;
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
    .first<{ id: string }>();

  if (existingWithinWindow) {
    logger.info('[sla-cron] Skipping duplicate incident within sliding window', {
      reservationId: incident.reservationId,
      breachType: incident.breachType,
      existingIncidentId: existingWithinWindow.id,
      windowBoundary,
    });
    return { mcuDelta: 0, centsDelta: 0, skipped: true, refundLedgerId: null };
  }

  const reservation = await getReservationById(db, incident.reservationId);
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
      };

  let refundLedgerId: string | null = null;
  let mcuDelta = 0;
  let centsDelta = 0;

  if (incident.compensationRail === 'USDT_REFUND') {
    refundLedgerId = generateRefundLedgerId();
    await db
      .prepare(
        `INSERT INTO refund_ledger (
          id, refund_request_id, user_id, purchase_id, payment_id,
          amount_cents, tier_before, tier_after, mcu_clawed_back, tx_hash, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        refundLedgerId,
        `req_${incident.id}`,
        incident.orgId,
        incident.reservationId,
        `pay_sla_${incident.id}`,
        incident.creditAmountCents,
        'ENTERPRISE',
        'ENTERPRISE',
        0,
        'SLA_DEGRADATION',
        now,
      )
      .run();

    centsDelta = incident.creditAmountCents;
    incident.refundLedgerId = refundLedgerId;
  } else if (incident.compensationRail === 'MCU_CREDIT') {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET mcu_consumed = MAX(0, mcu_consumed - ?1),
             updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(compensation.compensationMcu, now, incident.reservationId)
      .run();

    await recordMcuLedgerTransaction(db, incident, compensation.compensationMcu, now);
    mcuDelta = compensation.compensationMcu;
  } else {
    centsDelta = incident.creditAmountCents;
  }

  const resolutionNotes =
    incident.compensationRail === 'USDT_REFUND'
      ? `Auto-refunded ${incident.creditAmountCents}¢ USDT via ledger ${refundLedgerId}`
      : `Auto-compensated ${compensation.compensationMcu} MCU credits (${incident.creditAmountCents}¢)`;

  // Check if incident row already exists (e.g. seeded as pending)
  const existingRow = await db
    .prepare('SELECT id FROM sla_degradation_incidents WHERE id = ?1')
    .bind(incident.id)
    .first<{ id: string }>();

  if (existingRow) {
    await db
      .prepare(
        `UPDATE sla_degradation_incidents
         SET refund_status = 'disbursed',
             refund_ledger_id = ?1,
             resolved_at = ?2,
             resolution_notes = ?3,
             updated_at = ?2
         WHERE id = ?4`,
      )
      .bind(refundLedgerId, now, resolutionNotes, incident.id)
      .run();
  } else {
    // Persist incident in D1
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
        incident.id,
        incident.reservationId,
        incident.orgId,
        incident.breachType,
        incident.region,
        incident.targetThreshold,
        incident.measuredValue,
        incident.startedAt,
        now, // resolvedAt
        incident.durationSeconds ?? windowSeconds,
        incident.impactedJobsCount,
        incident.creditAmountCents,
        incident.compensationRail,
        'disbursed',
        refundLedgerId,
        'cron_sla_monitor',
        resolutionNotes,
        now,
        now,
      )
      .run();
  }

  // Check severe degradation to mark reservation status
  const isSevereUptime = incident.breachType === 'uptime' && incident.measuredValue < 0.95;
  const isSevereLatency = incident.breachType === 'latency_p95' && incident.measuredValue > 2500;
  if (isSevereUptime || isSevereLatency) {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET status = 'degraded', updated_at = ?1
         WHERE id = ?2 AND status = 'active'`,
      )
      .bind(now, incident.reservationId)
      .run();
  }

  return { mcuDelta, centsDelta, refundLedgerId };
}

/**
 * Execute the automated SLA refund monitor scan across enterprise GPU reservations.
 */
export async function runSlaRefundMonitorScan(
  db: D1Database,
  options: SlaMonitorScanOptions = {},
): Promise<SlaScanSummary> {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const dryRun = options.dryRun ?? false;

  const summary: SlaScanSummary = {
    scannedReservations: 0,
    incidentsDetected: 0,
    incidentsDisbursed: 0,
    totalCompensationMcu: 0,
    totalCompensationCents: 0,
    errors: [],
  };

  try {
    const countSql = options.reservationId
      ? 'SELECT COUNT(*) as count FROM enterprise_gpu_reservations WHERE id = ?1'
      : `SELECT COUNT(*) as count FROM enterprise_gpu_reservations
         WHERE status IN ('active', 'degraded') AND active_from <= ?1 AND active_until > ?1`;

    const countParam = options.reservationId ?? now;
    const countQuery = await db
      .prepare(countSql)
      .bind(countParam)
      .first<{ count: number }>();

    summary.scannedReservations = countQuery?.count ?? 0;

    const incidents = await evaluateSlaDegradation(db, {
      windowSeconds: options.windowSeconds,
      nowSeconds: now,
      reservationId: options.reservationId,
    });

    summary.incidentsDetected = incidents.length;

    if (dryRun) {
      for (const inc of incidents) {
        const windowBoundary = now - (options.windowSeconds ?? inc.durationSeconds ?? 900);
        const existing = await db
          .prepare(
            `SELECT id FROM sla_degradation_incidents
             WHERE reservation_id = ?1
               AND breach_type = ?2
               AND (created_at >= ?3 OR started_at >= ?3)
             LIMIT 1`,
          )
          .bind(inc.reservationId, inc.breachType, windowBoundary)
          .first<{ id: string }>();

        if (existing) {
          continue;
        }

        summary.totalCompensationCents += inc.creditAmountCents;
        const res = await getReservationById(db, inc.reservationId);
        if (res) {
          const comp = calculateSlaCompensation(
            res,
            inc.breachType,
            inc.impactedJobsCount,
            inc.compensationRail,
          );
          summary.totalCompensationMcu += comp.compensationMcu;
        }
      }
      return summary;
    }

    for (const incident of incidents) {
      try {
        const { mcuDelta, centsDelta, skipped } = await processSingleIncident(
          db,
          incident,
          now,
          options.windowSeconds ?? incident.durationSeconds ?? 900,
        );
        if (!skipped) {
          summary.totalCompensationMcu += mcuDelta;
          summary.totalCompensationCents += centsDelta;
          summary.incidentsDisbursed++;
        }
      } catch (incidentError) {
        const errorMsg = `Failed to process incident ${incident.id}: ${String(incidentError)}`;
        logger.error('[sla-cron] Incident processing error', { error: errorMsg });
        summary.errors.push(errorMsg);
      }
    }

    return summary;
  } catch (scanError) {
    const errorMsg = `SLA monitor scan failed: ${String(scanError)}`;
    logger.error('[sla-cron] Scan failure', { error: errorMsg });
    summary.errors.push(errorMsg);
    return summary;
  }
}
