/**
 * Multi-cloud action types & interfaces
 * @module land/multicloud/actions/types
 */

export type {
  MulticloudMeshTopology,
  RouteRequestInput,
  RouteDecisionResult,
  TriggerFailoverInput,
  FailoverExecutionResult,
  CloudFailoverAuditLog,
  CloudFailoverAuditLogRow,
  ZeroEgressFabricStatus,
  ZeroEgressAssetRoutingInput,
  ZeroEgressRouteResult,
  ReplicationSyncInput,
  RegisterEdgeRegionInput,
  HeartbeatRegionInput,
  MulticloudActionError,
} from '@/seed/types/multicloud-mesh';

export { mapRowToFailoverAuditLog } from '@/seed/types/multicloud-mesh';
