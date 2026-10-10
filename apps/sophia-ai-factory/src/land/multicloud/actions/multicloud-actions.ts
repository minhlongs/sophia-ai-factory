'use server';

/**
 * Server Actions: Multi-Cloud Edge Federation & Zero-Egress Storage Fabric
 * Layer: land/multicloud/actions
 *
 * @module land/multicloud/actions/multicloud-actions
 */

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
} from '@/tree/multicloud/zero-egress-mesh';
import type {
  MulticloudMeshTopology,
  RouteRequestInput,
  RouteDecisionResult,
  TriggerFailoverInput,
  FailoverExecutionResult,
  CloudFailoverAuditLog,
  ZeroEgressFabricStatus,
  ZeroEgressAssetRoutingInput,
  ZeroEgressRouteResult,
  ReplicationSyncInput,
  RegisterEdgeRegionInput,
  HeartbeatRegionInput,
  MulticloudActionError,
} from './types';
import {
  requireAuth,
  getRequiredD1,
  executeRegisterEdgeRegion,
  executeHeartbeatEdgeRegion,
} from './provider-health-checker';
import { executeAuditLogsQuery, executeReplicationSync } from './failover-orchestrator';

export async function getMulticloudTopologyAction(): Promise<Result<MulticloudMeshTopology, MulticloudActionError>> {
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

export async function routeTrafficRequestAction(
  input: RouteRequestInput,
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

export async function triggerAutonomousFailoverAction(
  input: TriggerFailoverInput,
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

export async function getFailoverAuditLogsAction(options?: {
  limit?: number;
  triggerReason?: string;
}): Promise<Result<CloudFailoverAuditLog[], MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return executeAuditLogsQuery(db, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] getFailoverAuditLogsAction failed', { error: message });
    return failure({ code: 'AUDIT_QUERY_ERROR', message });
  }
}

export async function getZeroEgressFabricStatusAction(): Promise<Result<ZeroEgressFabricStatus, MulticloudActionError>> {
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

export async function routeZeroEgressAssetAction(
  input: ZeroEgressAssetRoutingInput,
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

export async function syncStoragePoolReplicaAction(
  input: ReplicationSyncInput,
): Promise<Result<{ success: boolean; lagMs: number; verified: boolean }, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return executeReplicationSync(db, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] syncStoragePoolReplicaAction failed', { error: message });
    return failure({ code: 'REPLICATION_SYNC_ERROR', message });
  }
}

export async function registerEdgeRegionAction(
  input: RegisterEdgeRegionInput,
): Promise<Result<{ regionId: string }, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return executeRegisterEdgeRegion(db, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] registerEdgeRegionAction failed', { error: message });
    return failure({ code: 'REGION_REGISTRATION_ERROR', message });
  }
}

export async function heartbeatEdgeRegionAction(
  input: HeartbeatRegionInput,
): Promise<Result<{ acknowledged: boolean }, MulticloudActionError>> {
  try {
    const db = await getRequiredD1();
    return executeHeartbeatEdgeRegion(db, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[multicloud-actions] heartbeatEdgeRegionAction failed', { error: message });
    return failure({ code: 'HEARTBEAT_ERROR', message });
  }
}
