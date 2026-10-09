/**
 * Creator action for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-creator
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseGpuReservation,
  CreateReservationInput,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import type { ActionError } from './types';
import { assertAdminAccess } from './auth-guard';

/**
 * Generate a random UUID-like reservation ID
 */
export function generateReservationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `egr_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `egr_${timestamp}${randomPart}`;
}

/**
 * Create and provision a new dedicated enterprise GPU reservation
 */
export async function createGpuReservationAction(
  input: CreateReservationInput,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  if (!input.orgId) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Organization ID is required' });
  }

  const now = Math.floor(Date.now() / 1000);
  const id = generateReservationId();
  const laneId =
    input.laneId ||
    `lane_dedicated_${input.orgId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Math.random().toString(36).slice(2, 6)}`;
  const primaryRegion = input.primaryRegion || 'apac';
  const fallbackRegions = input.fallbackRegions || ['us', 'eu'];
  const reservedUnits = input.reservedUnits || GPU_MESH_SLA_CONFIG.defaultReservedUnits;
  const concurrencyLimit =
    input.concurrencyLimit || GPU_MESH_SLA_CONFIG.defaultConcurrencyLimit;
  const mcuMonthlyAllocation =
    input.mcuMonthlyAllocation || GPU_MESH_SLA_CONFIG.defaultMonthlyMcu;
  const priorityScore =
    input.priorityScore || GPU_MESH_SLA_CONFIG.dedicatedLanePriorityScore;
  const slaUptimeTarget =
    input.slaUptimeTarget || GPU_MESH_SLA_CONFIG.defaultUptimeTarget;
  const slaP95LatencyMs =
    input.slaP95LatencyMs || GPU_MESH_SLA_CONFIG.defaultP95LatencyCeilingMs;
  const slaDegradationWindowSecs =
    input.slaDegradationWindowSecs || GPU_MESH_SLA_CONFIG.defaultEvaluationWindowSecs;
  const slaRefundPct = input.slaRefundPct || GPU_MESH_SLA_CONFIG.defaultRefundPct;
  const allocatedProviders = input.allocatedProviders || ['fal', 'runpod', 'mekong'];
  const activeFrom = input.activeFrom || now;
  const activeUntil = input.activeUntil;

  if (activeUntil <= activeFrom) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: 'activeUntil must be in the future beyond activeFrom',
    });
  }

  try {
    await db
      .prepare(
        `INSERT INTO enterprise_gpu_reservations (
          id, org_id, deal_id, contract_id, lane_id,
          primary_region, fallback_regions, reserved_units, concurrency_limit,
          mcu_monthly_allocation, mcu_consumed, priority_score, status,
          sla_uptime_target, sla_p95_latency_ms, sla_degradation_window_secs, sla_refund_pct,
          allocated_providers, active_from, active_until, metadata,
          created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5,
          ?6, ?7, ?8, ?9,
          ?10, 0, ?11, 'active',
          ?12, ?13, ?14, ?15,
          ?16, ?17, ?18, ?19,
          ?20, ?21
        )`,
      )
      .bind(
        id,
        input.orgId,
        input.dealId ?? null,
        input.contractId ?? null,
        laneId,
        primaryRegion,
        JSON.stringify(fallbackRegions),
        reservedUnits,
        concurrencyLimit,
        mcuMonthlyAllocation,
        priorityScore,
        slaUptimeTarget,
        slaP95LatencyMs,
        slaDegradationWindowSecs,
        slaRefundPct,
        JSON.stringify(allocatedProviders),
        activeFrom,
        activeUntil,
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
      )
      .run();

    const created = await getReservationById(db, id);
    if (!created) {
      return failure({ code: 'DB_ERROR', message: 'Failed to verify created reservation' });
    }

    logger.info('[gpu-reservations-actions] Created enterprise GPU reservation', {
      id,
      orgId: input.orgId,
      laneId,
      admin: auth.value.email,
    });

    return success(created);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error creating GPU reservation', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}
