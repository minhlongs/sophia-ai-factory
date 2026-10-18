/**
 * @module tree/mekong/heartbeat-telemetry-types
 *
 * Mekong AI Hybrid Edge Node — Heartbeat, Telemetry & Routing Types
 * Layer Rule: pure types / seed imports only.
 */

import type { CostKind } from '@/seed/ai/cost-estimator';
import type { EdgeNodeStatus, EncryptedPayloadEnvelope } from './types';

export interface NodeHealthStatus {
  nodeId: string;
  status: EdgeNodeStatus;
  latencyMs: number;
  reachable: boolean;
  lastCheckedAt: number;
  runtime?: string;
  version?: string;
  error?: string;
}

export type PreflightProbeResult = NodeHealthStatus;

export interface HybridRoutingDecision {
  target: 'edge' | 'cloud';
  nodeId?: string;
  provider: string;
  costKind: CostKind;
  reason: string;
  decisionTimestamp: number;
}

export interface MekongHealthResponse {
  status: 'ok' | 'degraded' | 'error' | string;
  runtime?: string;
  version?: string;
  gpuUtilization?: number;
  memoryUsedMb?: number;
  activeModels?: string[];
}

export interface MekongHeartbeatTelemetry {
  gpuUtilizationPct: number;       // Range 0.0 - 100.0
  vramUsedBytes: number;           // Bytes in use
  vramTotalBytes: number;          // Total VRAM bytes
  queueDepth: number;              // Currently queued inference requests
  latencyMs?: number;              // Internal inference latency reported by node
  timestamp?: number;              // Daemon timestamp (ms)
  temperatureCelsius?: number;     // Apple Silicon SoC temperature (optional)
}

export interface InboundHeartbeatRequest {
  nodeId: string;
  bearerToken?: string;
  encryptedPayload?: string | EncryptedPayloadEnvelope; // Base64 JSON or Envelope
  telemetry?: MekongHeartbeatTelemetry;
  reportedStatus?: EdgeNodeStatus | string;
}

export interface HeartbeatIngestionResult {
  success: boolean;
  nodeId: string;
  heartbeatId: string;
  status: EdgeNodeStatus;
  recordedAt: number;
  latencyMs: number;
  error?: string;
}

export interface ClusterHealthReport {
  totalNodes: number;
  onlineCount: number;
  offlineCount: number;
  degradedCount?: number;
  transitionsToOffline: string[];
}

export interface TunnelClientOptions {
  timeoutMs?: number;
  encrypt?: boolean;
  headers?: Record<string, string>;
  allowLocal?: boolean;
}

export interface HybridRouterOptions {
  heartbeatThresholdMs?: number; // Default: 15000 (15s)
  tunnelTimeoutMs?: number;      // Default: 2500 (2.5s)
  allowFallback?: boolean;       // Default: true
  mockLatency?: boolean;         // Default: true in test environments
}
