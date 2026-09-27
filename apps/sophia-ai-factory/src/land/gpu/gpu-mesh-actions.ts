/**
 * Server Actions for Edge GPU Video Mesh & 6-Nines SLA Governance
 *
 * Implements:
 * - Cluster topology inspection & capacity telemetry
 * - AI video render job dispatching via dynamic workload balancing
 * - Six-Nines (99.9999%) SLA tracking & escrow balance inquiry
 * - Penalty escrow claim execution for SLA breaches
 * - Mesh-wide workload rebalancing and stale node health arbitration
 *
 * Layer: land/gpu (Public Server Actions — imports ONLY from @/seed and @/tree/gpu)
 * Strictly NO imports from @/forest.
 *
 * @module land/gpu/gpu-mesh-actions
 */

'use server';

import { getD1, type User } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { createLogger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type VideoRenderJobInput,
  type DispatchResult,
  type GpuMeshTopology,
  type SlaPenaltyEscrow,
  type SlaPenaltyEscrowDbRow,
  type PenaltyClaimResult,
  mapRowToSlaPenaltyEscrow,
} from '@/seed/types/edge-gpu-mesh';
import {
  dispatchRenderJob,
  getMeshTopology,
} from '@/tree/gpu/workload-balancer';
import {
  claimSlaPenalty,
} from '@/tree/gpu/six-nines-sla-engine';

const log = createLogger('land/gpu');

export interface ActionError {
  code:
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'DB_ERROR'
    | 'EXECUTION_ERROR';
  message: string;
}

/**
 * Authorization guard: verifies caller is authenticated.
 */
async function assertAuthenticatedUser(): Promise<Result<User, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return success(user);
}

/**
 * Authorization guard: verifies caller has admin privileges.
 */
async function assertAdminAccess(): Promise<Result<User, ActionError>> {
  const authResult = await assertAuthenticatedUser();
  if (!authResult.ok) return authResult;

  const user = authResult.value;
  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    return failure({
      code: 'FORBIDDEN',
      message: 'Administrative privileges required for mesh operations',
    });
  }

  return success(user);
}

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
 * Server Action: Retrieves Six-Nines SLA status and penalty escrow ledger for a tenant.
 */
export async function getSixNinesSlaStatusAction(
  tenantId: string,
  periodMonth: string,
): Promise<Result<SlaPenaltyEscrow, ActionError>> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const row = await db
      .prepare(
        'SELECT * FROM sla_penalty_escrow WHERE tenant_id = ? AND period_month = ?',
      )
      .bind(tenantId, periodMonth)
      .first<SlaPenaltyEscrowDbRow>();

    if (!row) {
      return failure({
        code: 'NOT_FOUND',
        message: `No SLA escrow record found for tenant ${tenantId} and period ${periodMonth}`,
      });
    }

    return success(mapRowToSlaPenaltyEscrow(row));
  } catch (error) {
    const err = toError(error);
    log.error('Failed to query SLA escrow status', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to query SLA escrow status',
    });
  }
}

/**
 * Server Action: Submits a claim against an SLA penalty escrow fund.
 */
export async function claimSlaPenaltyAction(
  escrowId: string,
): Promise<Result<PenaltyClaimResult, ActionError>> {
  const auth = await assertAuthenticatedUser();
  if (!auth.ok) return auth;

  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'Database binding unavailable' });
    }

    const claimResult = await claimSlaPenalty(db, escrowId);
    log.info('SLA penalty claimed successfully', {
      escrowId,
      claimedCents: claimResult.claimedCents,
    });

    return success(claimResult);
  } catch (error) {
    const err = toError(error);
    log.error('Failed to claim SLA penalty', err);
    return failure({
      code: 'EXECUTION_ERROR',
      message: err.message || 'Failed to claim SLA penalty',
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
