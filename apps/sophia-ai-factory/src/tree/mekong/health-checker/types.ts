/**
 * Mekong Health Checker Types & Constants
 *
 * @module tree/mekong/health-checker/types
 */

export const HEARTBEAT_TIMEOUT_MS = 15_000; // 15 seconds

export type {
  ClusterHealthReport,
  HeartbeatIngestionResult,
  InboundHeartbeatRequest,
  MekongHeartbeatTelemetry,
  NodeHealthStatus,
  EdgeNodeStatus,
  EncryptedPayloadEnvelope,
} from '../types';
