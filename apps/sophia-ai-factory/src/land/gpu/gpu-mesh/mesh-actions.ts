'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { createLogger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  ActionError,
  VideoRenderJobInput,
  DispatchResult,
  GpuMeshTopology,
} from './types';
import { assertAuthenticatedUser, assertAdminAccess } from './auth';
import {
  dispatchRenderJob,
  getMeshTopology,
} from '@/tree/gpu/workload-balancer';

const log = createLogger('land/gpu');

/**
 * Server Action: Fetches global GPU edge mesh topology and capacity metrics.
 */
export async function getGpuMeshTopologyAction(): Promise<
  Result<GpuMeshTopology, ActionError>
> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const topology = await getMeshTopology(db);
    return success(topology);
  } catch (error) {
    const err = toError(error);
    log.error('Failed to get GPU mesh topology', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to retrieve GPU mesh topology',
    });
  }
}

/**
 * Server Action: Dispatches an AI video render task to the optimal edge GPU node.
 */
export async function dispatchRenderJobAction(
  jobInput: VideoRenderJobInput,
): Promise<Result<DispatchResult, ActionError>> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const result = await dispatchRenderJob(db, jobInput);
    log.info('Video render job dispatched successfully', {
      dispatchId: result.dispatchId,
      nodeId: result.selectedNodeId,
      resolution: jobInput.videoResolution,
    });

    return success(result);
  } catch (error) {
    const err = toError(error);
    log.error('Failed to dispatch video render job', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to dispatch video render job',
    });
  }
}

/**
 * Server Action (Admin only): Rebalances GPU node assignments and flags unresponsive nodes.
 */
export async function rebalanceGpuWorkloadsAction(): Promise<
  Result<GpuMeshTopology, ActionError>
> {
  const adminAuth = await assertAdminAccess();
  if (!adminAuth.ok) return adminAuth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const now = Date.now();
    const staleThreshold = now - 300_000; // 5 minutes without heartbeat

    // Mark stale nodes as degraded
    await db
      .prepare(
        `UPDATE gpu_compute_nodes
         SET status = 'degraded',
             is_healthy = 0,
             health_score = 0.3,
             updated_at = ?
         WHERE last_heartbeat_at < ? AND status = 'online'`,
      )
      .bind(now, staleThreshold)
      .run();

    const topology = await getMeshTopology(db);
    log.info('GPU workloads rebalanced successfully', {
      totalNodes: topology.totalNodes,
      onlineNodes: topology.onlineNodes,
      degradedNodes: topology.degradedNodes,
    });

    return success(topology);
  } catch (error) {
    const err = toError(error);
    log.error('Failed to rebalance GPU workloads', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to rebalance GPU workloads',
    });
  }
}
