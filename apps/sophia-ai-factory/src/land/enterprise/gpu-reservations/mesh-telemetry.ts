/**
 * Telemetry and SLA incident actions for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/mesh-telemetry
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  GpuMeshRegionHealth,
  SlaDegradationIncident,
  SlaDegradationIncidentRow,
} from '@/seed/types/gpu-mesh';
import { mapRowToIncident } from '@/seed/types/gpu-mesh';
import { getRegionsHealth } from '@/tree/gpu-mesh/multi-region-router';
import type { ActionError } from './types';
import { assertAdminAccess } from './auth-guard';

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
