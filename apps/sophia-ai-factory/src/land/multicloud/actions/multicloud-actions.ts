'use server';

/**
 * Server Actions: Multi-Cloud Edge Federation & Zero-Egress Storage Fabric
 * Layer: land/multicloud/actions
 *
 * @module land/multicloud/actions/multicloud-actions
 */

import { success, type Result } from '@/seed/types/result';
import { getMulticloudTopology } from '@/tree/multicloud/multicloud-router';
import { getZeroEgressFabricStatus } from '@/tree/multicloud/zero-egress-mesh';
import type {
  MulticloudMeshTopology, RouteRequestInput, RouteDecisionResult, TriggerFailoverInput,
  FailoverExecutionResult, CloudFailoverAuditLog, ZeroEgressFabricStatus,
  ZeroEgressAssetRoutingInput, ZeroEgressRouteResult, ReplicationSyncInput,
  RegisterEdgeRegionInput, HeartbeatRegionInput, MulticloudActionError,
} from './types';
import {
  requireAuth, getRequiredD1, executeRegisterEdgeRegion, executeHeartbeatEdgeRegion,
} from './provider-health-checker';
import { executeAuditLogsQuery, executeReplicationSync } from './failover-orchestrator';
import { multicloudActionFailure } from './multicloud-action-helpers';
import {
  executeValidatedRouteTraffic,
  executeValidatedAutonomousFailover,
  executeValidatedZeroEgressAssetRoute,
} from './multicloud-routing-helpers';

export async function getMulticloudTopologyAction(): Promise<Result<MulticloudMeshTopology, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return success(await getMulticloudTopology(db));
  } catch (err) {
    return multicloudActionFailure('getMulticloudTopologyAction', 'TOPOLOGY_QUERY_ERROR', err);
  }
}

export async function routeTrafficRequestAction(
  input: RouteRequestInput,
): Promise<Result<RouteDecisionResult, MulticloudActionError>> {
  try {
    return await executeValidatedRouteTraffic(input);
  } catch (err) {
    return multicloudActionFailure('routeTrafficRequestAction', 'ROUTING_ERROR', err);
  }
}

export async function triggerAutonomousFailoverAction(
  input: TriggerFailoverInput,
): Promise<Result<FailoverExecutionResult, MulticloudActionError>> {
  try {
    return await executeValidatedAutonomousFailover(input);
  } catch (err) {
    return multicloudActionFailure('triggerAutonomousFailoverAction', 'FAILOVER_EXECUTION_ERROR', err);
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
    return multicloudActionFailure('getFailoverAuditLogsAction', 'AUDIT_QUERY_ERROR', err);
  }
}

export async function getZeroEgressFabricStatusAction(): Promise<Result<ZeroEgressFabricStatus, MulticloudActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return success(await getZeroEgressFabricStatus(db));
  } catch (err) {
    return multicloudActionFailure('getZeroEgressFabricStatusAction', 'STORAGE_FABRIC_ERROR', err);
  }
}

export async function routeZeroEgressAssetAction(
  input: ZeroEgressAssetRoutingInput,
): Promise<Result<ZeroEgressRouteResult, MulticloudActionError>> {
  try {
    return await executeValidatedZeroEgressAssetRoute(input);
  } catch (err) {
    return multicloudActionFailure('routeZeroEgressAssetAction', 'ASSET_ROUTING_ERROR', err);
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
    return multicloudActionFailure('syncStoragePoolReplicaAction', 'REPLICATION_SYNC_ERROR', err);
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
    return multicloudActionFailure('registerEdgeRegionAction', 'REGION_REGISTRATION_ERROR', err);
  }
}

export async function heartbeatEdgeRegionAction(
  input: HeartbeatRegionInput,
): Promise<Result<{ acknowledged: boolean }, MulticloudActionError>> {
  try {
    const db = await getRequiredD1();
    return executeHeartbeatEdgeRegion(db, input);
  } catch (err) {
    return multicloudActionFailure('heartbeatEdgeRegionAction', 'HEARTBEAT_ERROR', err);
  }
}
