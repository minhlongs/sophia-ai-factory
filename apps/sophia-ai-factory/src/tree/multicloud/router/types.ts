/**
 * Multi-Cloud Edge Traffic Router Types & Constants
 *
 * Layer: tree/multicloud/router
 */

export type {
  MulticloudEdgeRegion,
  MulticloudEdgeRegionRow,
  RouteRequestInput,
  RouteDecisionResult,
  TriggerFailoverInput,
  FailoverExecutionResult,
  MulticloudMeshTopology,
  GeographicZone,
} from '@/seed/types/multicloud-mesh';

export const P95_LATENCY_ANOMALY_THRESHOLD_MS = 75.0;
export const CONSECUTIVE_FAILURE_LIMIT = 3;
export const ERROR_RATE_ANOMALY_THRESHOLD = 0.03;
