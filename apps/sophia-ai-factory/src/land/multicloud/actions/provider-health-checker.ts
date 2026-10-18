/**
 * Provider health & authentication helpers for multi-cloud mesh
 * @module land/multicloud/actions/provider-health-checker
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  RegisterEdgeRegionInput,
  MulticloudActionError,
} from './types';

export { executeHeartbeatEdgeRegion } from './edge-region-heartbeat';

/**
 * Ensures caller is an authenticated user session
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform this multi-cloud operation.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error
 */
export async function getRequiredD1(): Promise<D1Database> {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}

export async function executeRegisterEdgeRegion(
  db: D1Database,
  input: RegisterEdgeRegionInput,
): Promise<Result<{ regionId: string }, MulticloudActionError>> {
  try {
    if (!input.regionCode || !input.provider || !input.tierRole || !input.endpointUrl || !input.geographicZone) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'regionCode, provider, tierRole, endpointUrl, and geographicZone are required.',
      });
    }

    const id = input.id ?? `region_${input.provider}_${input.regionCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const now = Date.now();

    await db
      .prepare(`
        INSERT INTO multicloud_edge_regions (
          id, region_code, provider, tier_role, status, endpoint_url, geographic_zone,
          latitude, longitude, max_concurrency, gpu_capacity_total, capabilities_json,
          metadata_json, registered_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        ON CONFLICT(region_code) DO UPDATE SET
          endpoint_url = excluded.endpoint_url,
          tier_role = excluded.tier_role,
          max_concurrency = excluded.max_concurrency,
          gpu_capacity_total = excluded.gpu_capacity_total,
          capabilities_json = excluded.capabilities_json,
          updated_at = excluded.updated_at
      `)
      .bind(
        id,
        input.regionCode,
        input.provider,
        input.tierRole,
        input.endpointUrl,
        input.geographicZone,
        input.latitude ?? null,
        input.longitude ?? null,
        input.maxConcurrency ?? 5000,
        input.gpuCapacityTotal ?? 0,
        JSON.stringify(input.capabilities ?? []),
        JSON.stringify(input.metadata ?? {}),
        now,
        now,
      )
      .run();

    return success({ regionId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] registerEdgeRegionAction failed', { error: message });
    return failure({ code: 'REGION_REGISTRATION_ERROR', message });
  }
}
