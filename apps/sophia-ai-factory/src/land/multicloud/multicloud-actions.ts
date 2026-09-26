'use server';

/**
 * Server Actions: Multi-Cloud Edge Federation & Zero-Egress Storage Fabric
 *
 * Layer: land (Next.js 15 Server Actions, auth verification, D1 persistence dispatch)
 * Dependencies:
 *   - @/seed/auth/better-auth-session
 *   - @/seed/db/client
 *   - @/seed/types/multicloud-mesh
 *   - @/seed/types/result
 *   - @/seed/utils/logger-utility
 *   - @/tree/multicloud/multicloud-router
 *   - @/tree/multicloud/zero-egress-mesh
 *
 * Rules:
 * - NO imports from @/forest or @/land
 * - NO :any types
 * - Strict auth enforcement via getCurrentUser()
 *
 * @module land/multicloud/multicloud-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import type {
  MulticloudMeshTopology,
  RouteRequestInput,
  RouteDecisionResult,
  TriggerFailoverInput,
  FailoverExecutionResult,
  CloudFailoverAuditLog,
  CloudFailoverAuditLogRow,
  ZeroEgressFabricStatus,
  ZeroEgressAssetRoutingInput,
  ZeroEgressRouteResult,
  ReplicationSyncInput,
  RegisterEdgeRegionInput,
  HeartbeatRegionInput,
  MulticloudActionError,
} from '@/seed/types/multicloud-mesh';
import {
  mapRowToFailoverAuditLog,
} from '@/seed/types/multicloud-mesh';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getMulticloudTopology,
  resolveOptimalEdgeRoute,
  executeSub30msFailover,
} from '@/tree/multicloud/multicloud-router';
import {
  getZeroEgressFabricStatus,
  resolveZeroEgressAssetUrl,
  recordReplicationSync,
} from '@/tree/multicloud/zero-egress-mesh';

/**
 * Ensures caller is an authenticated user session
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform this multi-cloud operation.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error
 */
async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}

/**
 * 1. Get Multicloud Mesh Topology Action
 * Returns active edge computing regions across Cloudflare, AWS, and GCP.
 */
export async function getMulticloudTopologyAction(): Promise<
  Result<MulticloudMeshTopology, MulticloudActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const topology = await getMulticloudTopology(db);
    return success(topology);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] getMulticloudTopologyAction failed', { error: message });
    return failure({ code: 'TOPOLOGY_QUERY_ERROR', message });
  }
}

/**
 * 2. Route Traffic Request Action
 * Dynamically resolves optimal edge route (Primary CF vs AWS fallback vs GCP GPU burst).
 */
export async function routeTrafficRequestAction(
  input: RouteRequestInput
): Promise<Result<RouteDecisionResult, MulticloudActionError>> {
  try {
    const db = await getRequiredD1();
    if (!input.geographicZone || !input.workloadType) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'geographicZone and workloadType are required parameters.',
      });
    }

    const decision = await resolveOptimalEdgeRoute(db, input);
    return success(decision);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] routeTrafficRequestAction failed', { error: message });
    return failure({ code: 'ROUTING_ERROR', message });
  }
}

/**
 * 3. Trigger Autonomous Failover Action
 * Executes deterministic sub-30ms failover upon anomaly detection.
 */
export async function triggerAutonomousFailoverAction(
  input: TriggerFailoverInput
): Promise<Result<FailoverExecutionResult, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!input.originRegionId || !input.triggerReason) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'originRegionId and triggerReason are required.',
      });
    }

    const result = await executeSub30msFailover(db, input);
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] triggerAutonomousFailoverAction failed', { error: message });
    return failure({ code: 'FAILOVER_EXECUTION_ERROR', message });
  }
}

/**
 * 4. Get Failover Audit Logs Action
 * Retrieves sub-30ms failover incident records.
 */
export async function getFailoverAuditLogsAction(options?: {
  limit?: number;
  triggerReason?: string;
}): Promise<Result<CloudFailoverAuditLog[], MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    let query = 'SELECT * FROM cloud_failover_audit_log WHERE 1=1';
    const params: unknown[] = [];

    if (options?.triggerReason) {
      params.push(options.triggerReason);
      query += ` AND trigger_reason = ?${params.length}`;
    }

    const limit = options?.limit ?? 50;
    params.push(limit);
    query += ` ORDER BY occurred_at DESC LIMIT ?${params.length}`;

    const { results } = await db.prepare(query).bind(...params).all<CloudFailoverAuditLogRow>();
    const logs = (results ?? []).map(mapRowToFailoverAuditLog);

    return success(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] getFailoverAuditLogsAction failed', { error: message });
    return failure({ code: 'AUDIT_QUERY_ERROR', message });
  }
}

/**
 * 5. Get Zero-Egress Fabric Status Action
 * Reports storage pools capacity, sync status, and zero-egress compliance.
 */
export async function getZeroEgressFabricStatusAction(): Promise<
  Result<ZeroEgressFabricStatus, MulticloudActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const status = await getZeroEgressFabricStatus(db);
    return success(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] getZeroEgressFabricStatusAction failed', { error: message });
    return failure({ code: 'STORAGE_FABRIC_ERROR', message });
  }
}

/**
 * 6. Route Zero-Egress Asset Action
 * Resolves download URL ensuring $0 internet egress via Cloudflare R2 / Bandwidth Alliance.
 */
export async function routeZeroEgressAssetAction(
  input: ZeroEgressAssetRoutingInput
): Promise<Result<ZeroEgressRouteResult, MulticloudActionError>> {
  try {
    const db = await getRequiredD1();
    if (!input.assetKey) {
      return failure({ code: 'VALIDATION_ERROR', message: 'assetKey is required.' });
    }

    const route = await resolveZeroEgressAssetUrl(db, input);
    return success(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] routeZeroEgressAssetAction failed', { error: message });
    return failure({ code: 'ASSET_ROUTING_ERROR', message });
  }
}

/**
 * 7. Sync Storage Pool Replica Action
 * Registers replication synchronization with SHA-256 cryptographic proof.
 */
export async function syncStoragePoolReplicaAction(
  input: ReplicationSyncInput
): Promise<Result<{ success: boolean; lagMs: number; verified: boolean }, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!input.assetKey || !input.sourcePoolKey || !input.targetPoolKey || !input.sha256Hash) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'assetKey, sourcePoolKey, targetPoolKey, and sha256Hash are required.',
      });
    }

    const syncResult = await recordReplicationSync(db, input);
    return success(syncResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] syncStoragePoolReplicaAction failed', { error: message });
    return failure({ code: 'REPLICATION_SYNC_ERROR', message });
  }
}

/**
 * 8. Register Edge Region Action
 * Registers a new cloud computing region in the federation.
 */
export async function registerEdgeRegionAction(
  input: RegisterEdgeRegionInput
): Promise<Result<{ regionId: string }, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

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
        now
      )
      .run();

    return success({ regionId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] registerEdgeRegionAction failed', { error: message });
    return failure({ code: 'REGION_REGISTRATION_ERROR', message });
  }
}

/**
 * 9. Heartbeat Edge Region Action
 * Reports latency, error rate, and GPU allocation metrics from edge telemetry daemons.
 */
export async function heartbeatEdgeRegionAction(
  input: HeartbeatRegionInput
): Promise<Result<{ acknowledged: boolean }, MulticloudActionError>> {
  try {
    const db = await getRequiredD1();
    if (!input.regionId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'regionId is required.' });
    }

    const now = Date.now();
    const isHealthy = (input.healthScore >= 0.8 && input.p95LatencyMs <= 75.0) ? 1 : 0;
    const consecutiveFailures = isHealthy ? 0 : (input.consecutiveFailures ?? 1);
    const status = isHealthy ? 'active' : 'degraded';

    await db
      .prepare(`
        UPDATE multicloud_edge_regions
        SET
          p95_latency_ms = ?1,
          p99_latency_ms = ?2,
          health_score = ?3,
          active_requests = ?4,
          is_healthy = ?5,
          consecutive_health_failures = ?6,
          status = ?7,
          gpu_capacity_allocated = COALESCE(?8, gpu_capacity_allocated),
          last_heartbeat_at = ?9,
          updated_at = ?9
        WHERE id = ?10
      `)
      .bind(
        input.p95LatencyMs,
        input.p99LatencyMs,
        input.healthScore,
        input.activeRequests,
        isHealthy,
        consecutiveFailures,
        status,
        input.gpuCapacityAllocated ?? null,
        now,
        input.regionId
      )
      .run();

    return success({ acknowledged: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] heartbeatEdgeRegionAction failed', { error: message });
    return failure({ code: 'HEARTBEAT_ERROR', message });
  }
}
