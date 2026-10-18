/**
 * Multi-Cloud Failover & Replication DTOs
 *
 * Layer: seed/types/multicloud-mesh
 */

import type {
  FailoverTriggerReason,
  FailoverStatus,
  FailoverActorType,
} from './failover-types';

export interface TriggerFailoverInput {
  originRegionId: string;
  destinationRegionId?: string;
  triggerReason: FailoverTriggerReason;
  errorRateBefore?: number;
  requestsDiverted?: number;
  actorType?: FailoverActorType;
  telemetrySnapshot?: Record<string, unknown>;
}

export interface FailoverExecutionResult {
  incidentCode: string;
  originRegionId: string;
  destinationRegionId: string;
  failoverDurationMs: number;
  isSub30ms: boolean;
  status: FailoverStatus;
  trafficShiftPct: number;
}

export interface ReplicationSyncInput {
  assetKey: string;
  sourcePoolKey: string;
  targetPoolKey: string;
  sha256Hash: string;
  fileSizeBytes: number;
}

export interface MulticloudActionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
