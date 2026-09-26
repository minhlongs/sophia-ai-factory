'use server';

/**
 * Server Actions: Autonomous Swarm Telemetry & Self-Healing Operations
 *
 * Layer: land (Next.js 15 Server Actions, auth verification, D1 persistence dispatch)
 * Dependencies:
 *   - @/seed/auth/better-auth-session
 *   - @/seed/db/client
 *   - @/seed/types/autonomous-swarm
 *   - @/seed/types/result
 *   - @/seed/utils/logger-utility
 *   - @/tree/swarm/swarm-coordinator
 *   - @/tree/swarm/retention-flywheel-engine
 *   - @/tree/swarm/sales-qualifier-bot
 *   - @/tree/swarm/self-healing-arbiter
 *
 * Rules:
 * - NO imports from @/forest or @/land
 * - NO :any types
 * - Strict auth enforcement via getCurrentUser()
 *
 * @module land/swarm/swarm-management-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import type {
  SwarmClusterTopology,
  RegisterSwarmNodeInput,
  HeartbeatTelemetryInput,
  CustomerHealthMetric,
  SwarmInterventionEvent,
  SwarmInterventionType,
  EdgeHealingIncident,
  InboundLeadPayload,
  QualificationResult,
  SwarmActionError,
} from '@/seed/types/autonomous-swarm';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getSwarmClusterTopology,
  registerSwarmNode,
  recordNodeHeartbeat,
  pruneDeadNodes,
} from '@/tree/swarm/swarm-coordinator';
import {
  getCustomerHealthSummary,
  runRetentionSweepBatch,
  executeManualIntervention,
} from '@/tree/swarm/retention-flywheel-engine';
import {
  processLeadWithSwarmNode,
} from '@/tree/swarm/sales-qualifier-bot';
import {
  isolateNode,
  resolveHealingIncident,
  queryHealingIncidents,
  runSelfHealingSweep,
} from '@/tree/swarm/self-healing-arbiter';

/**
 * Ensures caller is an authenticated user session.
 */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform this swarm operation.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error.
 */
async function getRequiredD1() {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}

/**
 * 1. Get Swarm Cluster Topology Action
 * Returns active nodes, regional distribution, and elected leader.
 */
export async function getSwarmClusterTopologyAction(): Promise<
  Result<SwarmClusterTopology, SwarmActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    // Auto-prune dead nodes before returning topology
    await pruneDeadNodes(db);
    const topology = await getSwarmClusterTopology(db);

    return success(topology);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] getSwarmClusterTopologyAction failed', { error: message });
    return failure({ code: 'TOPOLOGY_ERROR', message });
  }
}

/**
 * 2. Register Swarm Node Action
 * Registers or updates an edge daemon node in the cluster.
 */
export async function registerSwarmNodeAction(
  input: RegisterSwarmNodeInput
): Promise<Result<{ nodeId: string }, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!input.nodeName || !input.region || !input.role) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'nodeName, region, and role are required parameters.',
      });
    }

    const node = await registerSwarmNode(db, input);
    return success({ nodeId: node.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] registerSwarmNodeAction failed', { error: message });
    return failure({ code: 'REGISTRATION_ERROR', message });
  }
}

/**
 * 3. Heartbeat Swarm Node Action
 * Submitted by edge daemons to report telemetry metrics.
 */
export async function heartbeatSwarmNodeAction(
  input: HeartbeatTelemetryInput
): Promise<Result<{ status: string; acknowledged: boolean }, SwarmActionError>> {
  try {
    // Heartbeats from edge workers can be internal or authenticated
    const db = await getRequiredD1();

    if (!input.nodeId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'nodeId is required for heartbeat.' });
    }

    const result = await recordNodeHeartbeat(db, input);
    return success({ status: 'active', acknowledged: result.success });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] heartbeatSwarmNodeAction failed', { error: message });
    return failure({ code: 'HEARTBEAT_ERROR', message });
  }
}

/**
 * 4. Trigger Retention Flywheel Sweep Action
 * Scans active customer base and executes retention interventions.
 */
export async function triggerRetentionFlywheelSweepAction(
  limit: number = 50
): Promise<Result<{ evaluatedCount: number; interventionsTriggered: number }, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    const sweepResult = await runRetentionSweepBatch(db, limit);
    return success(sweepResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] triggerRetentionFlywheelSweepAction failed', { error: message });
    return failure({ code: 'SWEEP_ERROR', message });
  }
}

/**
 * 5. Get Customer Health Metrics Action
 * Queries real-time churn risk score and active risk factors.
 */
export async function getCustomerHealthMetricsAction(
  customerId: string
): Promise<Result<CustomerHealthMetric | null, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!customerId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'customerId is required.' });
    }

    const metric = await getCustomerHealthSummary(db, customerId);
    return success(metric);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] getCustomerHealthMetricsAction failed', { error: message });
    return failure({ code: 'METRICS_QUERY_ERROR', message });
  }
}

/**
 * 6. Execute Manual Intervention Action
 * Allows an authorized admin to trigger bonus credits, guides, or CS escalation.
 */
export async function executeManualInterventionAction(input: {
  customerId: string;
  interventionType: SwarmInterventionType;
  payload?: Record<string, unknown>;
}): Promise<Result<SwarmInterventionEvent, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!input.customerId || !input.interventionType) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'customerId and interventionType are required.',
      });
    }

    const event = await executeManualIntervention(db, input);
    return success(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] executeManualInterventionAction failed', { error: message });
    return failure({ code: 'INTERVENTION_ERROR', message });
  }
}

/**
 * 7. Query Edge Healing Incidents Action
 * Retrieves self-healing incidents audit trail.
 */
export async function getEdgeHealingIncidentsAction(options?: {
  nodeId?: string;
  limit?: number;
}): Promise<Result<EdgeHealingIncident[], SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    const incidents = await queryHealingIncidents(db, options);
    return success(incidents);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] getEdgeHealingIncidentsAction failed', { error: message });
    return failure({ code: 'INCIDENT_QUERY_ERROR', message });
  }
}

/**
 * 8. Isolate Degraded Node Action
 * Manually or programmatically isolates an edge node and trips circuit breaker.
 */
export async function isolateDegradedNodeAction(
  nodeId: string,
  reason: string
): Promise<Result<EdgeHealingIncident, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!nodeId || !reason) {
      return failure({ code: 'VALIDATION_ERROR', message: 'nodeId and reason are required.' });
    }

    const incident = await isolateNode(db, nodeId, reason);
    return success(incident);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] isolateDegradedNodeAction failed', { error: message });
    return failure({ code: 'ISOLATION_ERROR', message });
  }
}

/**
 * 9. Resolve Healing Incident Action
 * Marks an incident as recovered/resolved.
 */
export async function resolveHealingIncidentAction(
  incidentId: string,
  resolutionNotes?: string
): Promise<Result<{ success: boolean }, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!incidentId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'incidentId is required.' });
    }

    const result = await resolveHealingIncident(db, incidentId, resolutionNotes);
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] resolveHealingIncidentAction failed', { error: message });
    return failure({ code: 'RESOLUTION_ERROR', message });
  }
}

/**
 * 10. Qualify Lead Action
 * Processes an inbound lead through the sales qualifier bot.
 */
export async function qualifyLeadAction(
  payload: InboundLeadPayload
): Promise<Result<QualificationResult, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    if (!payload.leadEmail || !payload.companyName || !payload.companyDomain) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'leadEmail, companyName, and companyDomain are required.',
      });
    }

    const result = await processLeadWithSwarmNode(db, payload);
    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] qualifyLeadAction failed', { error: message });
    return failure({ code: 'QUALIFICATION_ERROR', message });
  }
}

/**
 * 11. Run Self-Healing Sweep Action
 * Runs edge node health checks, trips failing circuits, and reroutes traffic.
 */
export async function runSelfHealingSweepAction(): Promise<
  Result<{ evaluatedNodes: number; incidentsCreated: number; reroutesExecuted: number }, SwarmActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();

    const sweepResult = await runSelfHealingSweep(db);
    return success(sweepResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[swarm-actions] runSelfHealingSweepAction failed', { error: message });
    return failure({ code: 'HEALING_SWEEP_ERROR', message });
  }
}
