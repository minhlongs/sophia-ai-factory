/**
 * Swarm Action Types & DTOs
 * Layer: Land (Swarm)
 */

import type { SwarmInterventionType } from '@/seed/types/autonomous-swarm';

export type {
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

export interface ManualInterventionInput {
  customerId: string;
  interventionType: SwarmInterventionType;
  payload?: Record<string, unknown>;
}

export interface HealingIncidentsQueryOptions {
  nodeId?: string;
  limit?: number;
}
