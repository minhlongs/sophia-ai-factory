/**
 * Multi-Cloud Edge Federation & Storage Topology DTOs
 *
 * Layer: seed/types/multicloud-mesh
 */

import type {
  CloudProvider,
  EdgeTierRole,
  GeographicZone,
  StorageProvider,
  MulticloudEdgeRegion,
  ZeroEgressStoragePool,
} from './types';

export {
  type TriggerFailoverInput,
  type FailoverExecutionResult,
  type ReplicationSyncInput,
  type MulticloudActionError,
} from './failover-dtos';

export interface RouteRequestInput {
  clientIp?: string;
  geographicZone: GeographicZone;
  workloadType: 'standard_edge_api' | 'video_generation_burst' | 'asset_download';
  requiredGpuUnits?: number;
  maxAcceptableLatencyMs?: number;
}

export interface RouteDecisionResult {
  selectedRegionId: string;
  regionCode: string;
  provider: CloudProvider;
  tierRole: EdgeTierRole;
  targetEndpointUrl: string;
  estimatedLatencyMs: number;
  isGpuBurst: boolean;
  isFallback: boolean;
  routingReason: string;
  resolvedAt: number;
}

export interface ZeroEgressAssetRoutingInput {
  assetKey: string;
  expectedSha256?: string;
  preferredZone?: GeographicZone;
  isStreamingPlayback?: boolean;
}

export interface ZeroEgressRouteResult {
  downloadUrl: string;
  storagePoolKey: string;
  provider: StorageProvider;
  isZeroEgress: boolean;
  sha256Hash: string;
  integrityVerified: boolean;
  egressCostCents: number;
}

export interface RegisterEdgeRegionInput {
  id?: string;
  regionCode: string;
  provider: CloudProvider;
  tierRole: EdgeTierRole;
  endpointUrl: string;
  geographicZone: GeographicZone;
  latitude?: number;
  longitude?: number;
  maxConcurrency?: number;
  gpuCapacityTotal?: number;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatRegionInput {
  regionId: string;
  p95LatencyMs: number;
  p99LatencyMs: number;
  healthScore: number;
  activeRequests: number;
  consecutiveFailures?: number;
  gpuCapacityAllocated?: number;
}

export interface MulticloudMeshTopology {
  totalRegions: number;
  activeRegionsCount: number;
  degradedRegionsCount: number;
  primaryEdgeRegionId: string | null;
  regionalBreakdown: Record<GeographicZone, number>;
  regions: MulticloudEdgeRegion[];
}

export interface ZeroEgressFabricStatus {
  totalStorageBytes: number;
  totalObjectsCount: number;
  primaryPoolKey: string;
  pools: ZeroEgressStoragePool[];
  overallZeroEgressCompliance: boolean;
}
