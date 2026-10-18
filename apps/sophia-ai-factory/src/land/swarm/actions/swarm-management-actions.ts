'use server';

/**
 * Server Actions: Autonomous Swarm Telemetry & Self-Healing Operations
 * Layer: Land (Swarm)
 */

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
import { success, type Result } from '@/seed/types/result';
import { withAuthDbAction } from './swarm-validator';
import * as dispatcher from './worker-dispatcher';
import {
  runRegisterNode,
  runHeartbeatNode,
  runGetCustomerHealth,
  runManualIntervention,
  runIsolateNode,
  runResolveIncident,
  runQualifyLead,
} from './swarm-action-runners';

export async function getSwarmClusterTopologyAction(): Promise<
  Result<SwarmClusterTopology, SwarmActionError>
> {
  return withAuthDbAction('getSwarmClusterTopologyAction', 'TOPOLOGY_ERROR', async (db) => {
    return success(await dispatcher.fetchClusterTopology(db));
  });
}

export async function registerSwarmNodeAction(
  input: RegisterSwarmNodeInput
): Promise<Result<{ nodeId: string }, SwarmActionError>> {
  return runRegisterNode(input);
}

export async function heartbeatSwarmNodeAction(
  input: HeartbeatTelemetryInput
): Promise<Result<{ status: string; acknowledged: boolean }, SwarmActionError>> {
  return runHeartbeatNode(input);
}

export async function triggerRetentionFlywheelSweepAction(
  limit: number = 50
): Promise<Result<{ evaluatedCount: number; interventionsTriggered: number }, SwarmActionError>> {
  return withAuthDbAction('triggerRetentionFlywheelSweepAction', 'SWEEP_ERROR', async (db) => {
    return success(await dispatcher.executeRetentionSweep(db, limit));
  });
}

export async function getCustomerHealthMetricsAction(
  customerId: string
): Promise<Result<CustomerHealthMetric | null, SwarmActionError>> {
  return runGetCustomerHealth(customerId);
}

export async function executeManualInterventionAction(input: {
  customerId: string;
  interventionType: SwarmInterventionType;
  payload?: Record<string, unknown>;
}): Promise<Result<SwarmInterventionEvent, SwarmActionError>> {
  return runManualIntervention(input);
}

export async function getEdgeHealingIncidentsAction(options?: {
  nodeId?: string;
  limit?: number;
}): Promise<Result<EdgeHealingIncident[], SwarmActionError>> {
  return withAuthDbAction('getEdgeHealingIncidentsAction', 'INCIDENT_QUERY_ERROR', async (db) => {
    return success(await dispatcher.queryIncidents(db, options));
  });
}

export async function isolateDegradedNodeAction(
  nodeId: string,
  reason: string
): Promise<Result<EdgeHealingIncident, SwarmActionError>> {
  return runIsolateNode(nodeId, reason);
}

export async function resolveHealingIncidentAction(
  incidentId: string,
  resolutionNotes?: string
): Promise<Result<{ success: boolean }, SwarmActionError>> {
  return runResolveIncident(incidentId, resolutionNotes);
}

export async function qualifyLeadAction(
  payload: InboundLeadPayload
): Promise<Result<QualificationResult, SwarmActionError>> {
  return runQualifyLead(payload);
}

export async function runSelfHealingSweepAction(): Promise<
  Result<{ evaluatedNodes: number; incidentsCreated: number; reroutesExecuted: number }, SwarmActionError>
> {
  return withAuthDbAction('runSelfHealingSweepAction', 'HEALING_SWEEP_ERROR', async (db) => {
    return success(await dispatcher.executeHealingSweep(db));
  });
}
