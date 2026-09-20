/**
 * @module tree/mekong/types
 *
 * Mekong AI Hybrid Edge Node Synchronization — Core Domain Models & Contracts
 * Pure types for Cloudflare Tunnel communication, AES-256-GCM encryption,
 * heartbeat monitoring, and hybrid task routing.
 *
 * Layer Rule: pure types / seed imports only.
 */

import type { CostKind } from '@/seed/ai/cost-estimator';

export type { CostKind };

export type EdgeNodeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';

export type HardwareProfile =
  | 'apple_m1_max'
  | 'apple_m2_ultra'
  | 'apple_m3_max'
  | 'nvidia_rtx'
  | 'generic'
  | string;

export type TaskType = 'llm' | 'tts' | 'image' | 'video' | 'embedding' | 'batch' | string;

export interface EdgeNodeRecord {
  id: string;
  name: string;
  tunnel_url: string;
  bearer_token: string;
  status: EdgeNodeStatus | string;
  hardware_profile: string;
  cost_kind: CostKind;
  last_heartbeat_at: number;
  created_at: number;
}

export interface EncryptedPayloadEnvelope {
  version: 'v1';
  algorithm: 'AES-256-GCM';
  iv: string;         // Base64 encoded 12-byte IV
  ciphertext: string; // Base64 encoded ciphertext + 16-byte GCM auth tag
  timestamp: number;
}

export interface InferenceTask {
  taskId: string;
  type: TaskType;
  prompt: string;
  model: string;
  maxTokens?: number;
  tenantId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
  options?: {
    temperature?: number;
    timeoutMs?: number;
    allowFallback?: boolean;
    bypassEdge?: boolean;
  };
}

export type FallbackReason =
  | 'NO_ONLINE_NODE'
  | 'PREFERRED_NODE_NOT_FOUND'
  | 'NODE_OFFLINE'
  | 'STALE_HEARTBEAT'
  | 'PROBE_FAILED'
  | 'TUNNEL_TIMEOUT'
  | 'TUNNEL_ERROR'
  | 'BYPASS_REQUESTED'
  | 'UNSUPPORTED_TASK_TYPE';

export interface InferenceResult {
  taskId: string;
  provider: 'mekong_m1_max' | 'cloud_byok' | string;
  costKind: CostKind;
  output: string;
  latencyMs: number;
  encrypted: boolean;
  modelUsed?: string;
  fallbackTriggered?: boolean;
  fallbackReason?: FallbackReason;
  edgeNodeId?: string;
}

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
