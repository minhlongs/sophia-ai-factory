/**
 * worker-dispatcher.ts — Land Layer
 * Swarm worker execution and tree-layer domain dispatchers
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmClusterTopology,
  RegisterSwarmNodeInput,
  HeartbeatTelemetryInput,
  CustomerHealthMetric,
  SwarmInterventionEvent,
  EdgeHealingIncident,
  InboundLeadPayload,
  QualificationResult,
} from '@/seed/types/autonomous-swarm';
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
import { processLeadWithSwarmNode } from '@/tree/swarm/sales-qualifier-bot';
import {
  isolateNode,
  resolveHealingIncident,
  queryHealingIncidents,
  runSelfHealingSweep,
} from '@/tree/swarm/self-healing-arbiter';
import type { ManualInterventionInput, HealingIncidentsQueryOptions } from './types';

export async function fetchClusterTopology(db: D1Database): Promise<SwarmClusterTopology> {
  await pruneDeadNodes(db);
  return getSwarmClusterTopology(db);
}

export async function registerNode(db: D1Database, input: RegisterSwarmNodeInput): Promise<{ nodeId: string }> {
  const node = await registerSwarmNode(db, input);
  return { nodeId: node.id };
}

export async function recordHeartbeat(db: D1Database, input: HeartbeatTelemetryInput): Promise<{ status: string; acknowledged: boolean }> {
  const result = await recordNodeHeartbeat(db, input);
  return { status: 'active', acknowledged: result.success };
}

export async function executeRetentionSweep(db: D1Database, limit: number) {
  return runRetentionSweepBatch(db, limit);
}

export async function fetchCustomerHealth(db: D1Database, customerId: string): Promise<CustomerHealthMetric | null> {
  return getCustomerHealthSummary(db, customerId);
}

export async function dispatchManualIntervention(db: D1Database, input: ManualInterventionInput): Promise<SwarmInterventionEvent> {
  return executeManualIntervention(db, input);
}

export async function queryIncidents(db: D1Database, options?: HealingIncidentsQueryOptions): Promise<EdgeHealingIncident[]> {
  return queryHealingIncidents(db, options);
}

export async function isolateEdgeNode(db: D1Database, nodeId: string, reason: string): Promise<EdgeHealingIncident> {
  return isolateNode(db, nodeId, reason);
}

export async function resolveIncident(db: D1Database, incidentId: string, notes?: string): Promise<{ success: boolean }> {
  return resolveHealingIncident(db, incidentId, notes);
}

export async function processInboundLead(db: D1Database, payload: InboundLeadPayload): Promise<QualificationResult> {
  return processLeadWithSwarmNode(db, payload);
}

export async function executeHealingSweep(db: D1Database) {
  return runSelfHealingSweep(db);
}
