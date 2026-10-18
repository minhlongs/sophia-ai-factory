/**
 * Validated Swarm Action Runners
 * Layer: Land (Swarm)
 */

import type {
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

export function runRegisterNode(
  input: RegisterSwarmNodeInput,
): Promise<Result<{ nodeId: string }, SwarmActionError>> {
  return withAuthDbAction('registerSwarmNodeAction', 'REGISTRATION_ERROR', async (db) => {
    const error = validateRegisterNodeInput(input);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.registerNode(db, input));
  });
}

export function runHeartbeatNode(
  input: HeartbeatTelemetryInput,
): Promise<Result<{ status: string; acknowledged: boolean }, SwarmActionError>> {
  return withDbAction('heartbeatSwarmNodeAction', 'HEARTBEAT_ERROR', async (db) => {
    const error = validateHeartbeatInput(input);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.recordHeartbeat(db, input));
  });
}

export function runGetCustomerHealth(
  customerId: string,
): Promise<Result<CustomerHealthMetric | null, SwarmActionError>> {
  return withAuthDbAction('getCustomerHealthMetricsAction', 'METRICS_QUERY_ERROR', async (db) => {
    if (!customerId) return failure({ code: 'VALIDATION_ERROR', message: 'customerId is required.' });
    return success(await dispatcher.fetchCustomerHealth(db, customerId));
  });
}

export function runManualIntervention(input: {
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

export function runIsolateNode(
  nodeId: string,
  reason: string,
): Promise<Result<EdgeHealingIncident, SwarmActionError>> {
  return withAuthDbAction('isolateDegradedNodeAction', 'ISOLATION_ERROR', async (db) => {
    if (!nodeId || !reason) {
      return failure({ code: 'VALIDATION_ERROR', message: 'nodeId and reason are required.' });
    }
    return success(await dispatcher.isolateEdgeNode(db, nodeId, reason));
  });
}

export function runResolveIncident(
  incidentId: string,
  resolutionNotes?: string,
): Promise<Result<{ success: boolean }, SwarmActionError>> {
  return withAuthDbAction('resolveHealingIncidentAction', 'RESOLUTION_ERROR', async (db) => {
    if (!incidentId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'incidentId is required.' });
    }
    return success(await dispatcher.resolveIncident(db, incidentId, resolutionNotes));
  });
}

export function runQualifyLead(
  payload: InboundLeadPayload,
): Promise<Result<QualificationResult, SwarmActionError>> {
  return withAuthDbAction('qualifyLeadAction', 'QUALIFICATION_ERROR', async (db) => {
    const error = validateLeadPayload(payload);
    if (error) return failure({ code: 'VALIDATION_ERROR', message: error });
    return success(await dispatcher.processInboundLead(db, payload));
  });
}
