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
import { success, failure, type Result } from '@/seed/types/result';
import {
  withAuthDbAction,
  withDbAction,
  validateRegisterNodeInput,
  validateHeartbeatInput,
  validateManualInterventionInput,
  validateLeadPayload,
} from './swarm-validator';
import * as dispatcher from './worker-dispatcher';

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
  return withAuthDbAction('registerSwarmNodeAction', 'REGISTRATION_ERROR', async (db) => {
    const error = validateRegisterNodeInput(input);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.registerNode(db, input));
  });
}

export async function heartbeatSwarmNodeAction(
  input: HeartbeatTelemetryInput
): Promise<Result<{ status: string; acknowledged: boolean }, SwarmActionError>> {
  return withDbAction('heartbeatSwarmNodeAction', 'HEARTBEAT_ERROR', async (db) => {
    const error = validateHeartbeatInput(input);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.recordHeartbeat(db, input));
  });
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
  return withAuthDbAction('getCustomerHealthMetricsAction', 'METRICS_QUERY_ERROR', async (db) => {
    if (!customerId) return failure({ code: 'VALIDATION_ERROR', message: 'customerId is required.' });
    return success(await dispatcher.fetchCustomerHealth(db, customerId));
  });
}

export async function executeManualInterventionAction(input: {
  customerId: string;
  interventionType: SwarmInterventionType;
  payload?: Record<string, unknown>;
}): Promise<Result<SwarmInterventionEvent, SwarmActionError>> {
  return withAuthDbAction('executeManualInterventionAction', 'INTERVENTION_ERROR', async (db) => {
    const error = validateManualInterventionInput(input);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.dispatchManualIntervention(db, input));
  });
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
  return withAuthDbAction('isolateDegradedNodeAction', 'ISOLATION_ERROR', async (db) => {
    if (!nodeId || !reason) {
      return failure({ code: 'VALIDATION_ERROR', message: 'nodeId and reason are required.' });
    }
    return success(await dispatcher.isolateEdgeNode(db, nodeId, reason));
  });
}

export async function resolveHealingIncidentAction(
  incidentId: string,
  resolutionNotes?: string
): Promise<Result<{ success: boolean }, SwarmActionError>> {
  return withAuthDbAction('resolveHealingIncidentAction', 'RESOLUTION_ERROR', async (db) => {
    if (!incidentId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'incidentId is required.' });
    }
    return success(await dispatcher.resolveIncident(db, incidentId, resolutionNotes));
  });
}

export async function qualifyLeadAction(
  payload: InboundLeadPayload
): Promise<Result<QualificationResult, SwarmActionError>> {
  return withAuthDbAction('qualifyLeadAction', 'QUALIFICATION_ERROR', async (db) => {
    const error = validateLeadPayload(payload);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.processInboundLead(db, payload));
  });
}

export async function runSelfHealingSweepAction(): Promise<
  Result<{ evaluatedNodes: number; incidentsCreated: number; reroutesExecuted: number }, SwarmActionError>
> {
  return withAuthDbAction('runSelfHealingSweepAction', 'HEALING_SWEEP_ERROR', async (db) => {
    return success(await dispatcher.executeHealingSweep(db));
  });
}
