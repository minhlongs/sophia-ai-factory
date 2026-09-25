/**
 * Server Actions for Enterprise GPU Reservations & Mesh Administration
 *
 * Layer: land/enterprise (Public entry point & Server Actions)
 * Allowed dependencies: @/seed/*, @/tree/* (strictly NO imports from @/forest)
 *
 * Implements:
 * - RBAC permission check via getCurrentUser and isUserAdminWithRole
 * - Creation and provisioning of dedicated enterprise GPU lanes
 * - Querying and updating reservation parameters and SLAs
 * - Terminating reservations with graceful resource release
 * - Real-time mesh health and SLA breach incident queries
 *
 * @module land/enterprise/gpu-reservations-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
  GpuMeshRegionHealth,
  SlaDegradationIncident,
  SlaDegradationIncidentRow,
  CreateReservationInput,
  UpdateReservationInput,
  ReservationStatus,
  GpuMeshRegion,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation, mapRowToIncident } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import { getRegionsHealth } from '@/tree/gpu-mesh/multi-region-router';

export interface ActionError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR';
  message: string;
}

/**
 * Authorization guard: verifies current user and asserts admin role
 */
async function assertAdminAccess(): Promise<
  Result<{ userId: string; email: string }, ActionError>
> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    return failure({ code: 'FORBIDDEN', message: 'Enterprise admin privilege required' });
  }

  return success({ userId: user.id, email: user.email });
}

/**
 * Generate a random UUID-like reservation ID
 */
function generateReservationId(): string {
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

/**
 * Get an enterprise GPU reservation by ID
 */
export async function getGpuReservationAction(
  reservationId: string,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const reservation = await getReservationById(db, reservationId);
  if (!reservation) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  return success(reservation);
}

/**
 * List enterprise GPU reservations with optional filters
 */
export async function listGpuReservationsAction(filters: {
  orgId?: string;
  status?: ReservationStatus;
  region?: GpuMeshRegion;
  limit?: number;
} = {}): Promise<Result<EnterpriseGpuReservation[], ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  try {
    let query = 'SELECT * FROM enterprise_gpu_reservations WHERE 1=1';
    const params: unknown[] = [];

    if (filters.orgId) {
      params.push(filters.orgId);
      query += ` AND org_id = ?${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = ?${params.length}`;
    }

    if (filters.region) {
      params.push(filters.region);
      query += ` AND primary_region = ?${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const limit = Math.min(Math.max(1, filters.limit ?? 50), 100);
    params.push(limit);
    query += ` LIMIT ?${params.length}`;

    const stmt = db.prepare(query);
    const { results } = await stmt.bind(...params).all<EnterpriseGpuReservationRow>();

    const reservations = (results ?? []).map(mapRowToReservation);
    return success(reservations);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error listing reservations', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}

function buildReservationUpdateClauses(
  updates: UpdateReservationInput,
  existingMetadata: Record<string, unknown>,
  now: number,
): { setClauses: string[]; params: unknown[] } {
  const setClauses: string[] = ['updated_at = ?1'];
  const params: unknown[] = [now];

  const addField = (col: string, val: unknown) => {
    params.push(val);
    setClauses.push(`${col} = ?${params.length}`);
  };

  if (updates.status) addField('status', updates.status);
  if (typeof updates.reservedUnits === 'number') addField('reserved_units', updates.reservedUnits);
  if (typeof updates.concurrencyLimit === 'number') addField('concurrency_limit', updates.concurrencyLimit);
  if (typeof updates.mcuMonthlyAllocation === 'number') addField('mcu_monthly_allocation', updates.mcuMonthlyAllocation);
  if (typeof updates.priorityScore === 'number') addField('priority_score', updates.priorityScore);
  if (updates.primaryRegion) addField('primary_region', updates.primaryRegion);
  if (updates.fallbackRegions) addField('fallback_regions', JSON.stringify(updates.fallbackRegions));
  if (typeof updates.slaUptimeTarget === 'number') addField('sla_uptime_target', updates.slaUptimeTarget);
  if (typeof updates.slaP95LatencyMs === 'number') addField('sla_p95_latency_ms', updates.slaP95LatencyMs);
  if (typeof updates.slaRefundPct === 'number') addField('sla_refund_pct', updates.slaRefundPct);
  if (typeof updates.activeUntil === 'number') addField('active_until', updates.activeUntil);
  if (updates.allocatedProviders) addField('allocated_providers', JSON.stringify(updates.allocatedProviders));
  if (updates.metadata) {
    const merged = { ...existingMetadata, ...updates.metadata };
    addField('metadata', JSON.stringify(merged));
  }

  return { setClauses, params };
}

/**
 * Update an existing enterprise GPU reservation
 */
export async function updateGpuReservationAction(
  reservationId: string,
  updates: UpdateReservationInput,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const existing = await getReservationById(db, reservationId);
  if (!existing) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  const now = Math.floor(Date.now() / 1000);
  const { setClauses, params } = buildReservationUpdateClauses(updates, existing.metadata, now);

  params.push(reservationId);
  const sql = `UPDATE enterprise_gpu_reservations SET ${setClauses.join(', ')} WHERE id = ?${params.length}`;

  try {
    await db.prepare(sql).bind(...params).run();
    const updated = await getReservationById(db, reservationId);
    if (!updated) {
      return failure({ code: 'DB_ERROR', message: 'Failed to retrieve updated reservation' });
    }

    logger.info('[gpu-reservations-actions] Updated enterprise GPU reservation', {
      reservationId,
      updates,
      admin: auth.value.email,
    });

    return success(updated);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error updating reservation', {
      reservationId,
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}

/**
 * Terminate an enterprise GPU reservation
 */
export async function terminateGpuReservationAction(
  reservationId: string,
  reason = 'Admin terminated',
): Promise<Result<{ terminated: boolean; id: string }, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const existing = await getReservationById(db, reservationId);
  if (!existing) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET status = 'terminated',
             updated_at = ?1
         WHERE id = ?2`,
      )
      .bind(now, reservationId)
      .run();

    logger.info('[gpu-reservations-actions] Terminated GPU reservation', {
      reservationId,
      reason,
      admin: auth.value.email,
    });

    return success({ terminated: true, id: reservationId });
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error terminating reservation', {
      reservationId,
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}

/**
 * Fetch real-time health telemetry across all mesh regions
 */
export async function getGpuMeshHealthAction(): Promise<
  Result<GpuMeshRegionHealth[], ActionError>
> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  try {
    const health = await getRegionsHealth(db);
    return success(health);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error fetching mesh health', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}

/**
 * List SLA degradation incidents
 */
export async function listSlaIncidentsAction(options: {
  reservationId?: string;
  orgId?: string;
  limit?: number;
} = {}): Promise<Result<SlaDegradationIncident[], ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  try {
    let query = 'SELECT * FROM sla_degradation_incidents WHERE 1=1';
    const params: unknown[] = [];

    if (options.reservationId) {
      params.push(options.reservationId);
      query += ` AND reservation_id = ?${params.length}`;
    }

    if (options.orgId) {
      params.push(options.orgId);
      query += ` AND org_id = ?${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const limit = Math.min(Math.max(1, options.limit ?? 50), 100);
    params.push(limit);
    query += ` LIMIT ?${params.length}`;

    const { results } = await db
      .prepare(query)
      .bind(...params)
      .all<SlaDegradationIncidentRow>();

    const incidents = (results ?? []).map(mapRowToIncident);
    return success(incidents);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error listing SLA incidents', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}
