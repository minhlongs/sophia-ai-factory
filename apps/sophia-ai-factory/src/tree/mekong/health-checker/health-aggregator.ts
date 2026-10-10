/**
 * Health Telemetry Aggregation & Ingestion Engine for Mekong Edge Nodes
 *
 * @module tree/mekong/health-checker/health-aggregator
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '@/seed/utils/logger-utility';
import { decryptPayload } from '../crypto';
import type {
  EdgeNodeStatus,
  EncryptedPayloadEnvelope,
  HeartbeatIngestionResult,
  InboundHeartbeatRequest,
  MekongHeartbeatTelemetry,
} from './types';

const logger = createLogger('tree/mekong/health-checker/health-aggregator');

async function resolveHeartbeatTelemetry(
  rawTelemetry: MekongHeartbeatTelemetry | undefined,
  encryptedPayload: string | EncryptedPayloadEnvelope | undefined,
  bearerToken: string,
  nodeId: string,
): Promise<{ telemetry?: MekongHeartbeatTelemetry; decryptionFailed?: boolean }> {
  if (rawTelemetry) {
    return { telemetry: rawTelemetry };
  }

  if (encryptedPayload) {
    try {
      const envelope =
        typeof encryptedPayload === 'string'
          ? (JSON.parse(encryptedPayload) as EncryptedPayloadEnvelope)
          : encryptedPayload;
      const decrypted = await decryptPayload<MekongHeartbeatTelemetry>(envelope, bearerToken);
      return { telemetry: decrypted };
    } catch (err) {
      logger.error('MEKONG_HEARTBEAT_DECRYPTION_FAILED', {
        nodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { decryptionFailed: true };
    }
  }

  return {
    telemetry: {
      gpuUtilizationPct: 0,
      vramUsedBytes: 0,
      vramTotalBytes: 0,
      queueDepth: 0,
      latencyMs: 10.0,
    },
  };
}

function computeEffectiveNodeStatus(
  reportedStatus: string | undefined,
  telemetry: MekongHeartbeatTelemetry,
): EdgeNodeStatus {
  let effectiveStatus: EdgeNodeStatus = 'ONLINE';
  if (reportedStatus) {
    const norm = String(reportedStatus).toUpperCase();
    if (norm === 'DEGRADED' || norm === 'OFFLINE') {
      effectiveStatus = norm as EdgeNodeStatus;
    }
  }

  const vramSaturation =
    telemetry.vramTotalBytes > 0 ? telemetry.vramUsedBytes / telemetry.vramTotalBytes : 0;
  if (vramSaturation > 0.95 || telemetry.queueDepth > 10) {
    effectiveStatus = 'DEGRADED';
  }
  return effectiveStatus;
}

/**
 * Ingests and records inbound heartbeat telemetry from mekongd daemon.
 */
export async function processNodeHeartbeat(
  db: D1Database,
  request: InboundHeartbeatRequest,
  nowMs = Date.now(),
): Promise<HeartbeatIngestionResult> {
  const { nodeId, bearerToken, encryptedPayload, telemetry: rawTelemetry, reportedStatus } = request;

  // 1. Fetch node record
  const node = await db
    .prepare('SELECT id, bearer_token, status FROM edge_nodes WHERE id = ?')
    .bind(nodeId)
    .first<{ id: string; bearer_token: string; status: string }>();

  if (!node) {
    return {
      success: false,
      nodeId,
      heartbeatId: '',
      status: 'OFFLINE',
      recordedAt: nowMs,
      latencyMs: 0,
      error: 'NODE_NOT_FOUND',
    };
  }

  // 2. Validate Bearer Token if provided
  if (bearerToken && bearerToken !== node.bearer_token) {
    logger.warn('MEKONG_INVALID_BEARER_TOKEN', { nodeId });
    return {
      success: false,
      nodeId,
      heartbeatId: '',
      status: 'OFFLINE',
      recordedAt: nowMs,
      latencyMs: 0,
      error: 'INVALID_BEARER_TOKEN',
    };
  }

  // 3. Resolve telemetry (supports plaintext or AES-256-GCM encrypted payload)
  const resolved = await resolveHeartbeatTelemetry(
    rawTelemetry,
    encryptedPayload,
    node.bearer_token,
    nodeId,
  );

  if (resolved.decryptionFailed || !resolved.telemetry) {
    return {
      success: false,
      nodeId,
      heartbeatId: '',
      status: 'OFFLINE',
      recordedAt: nowMs,
      latencyMs: 0,
      error: 'DECRYPTION_FAILED',
    };
  }

  const telemetry = resolved.telemetry;

  // 4. Determine operational status based on hardware pressure
  const effectiveStatus = computeEffectiveNodeStatus(reportedStatus, telemetry);
  const latencyMs = Number(telemetry.latencyMs ?? 10.0);
  const heartbeatId = `hb_${nodeId}_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;

  // 5. Persist to D1
  await db
    .prepare(
      `INSERT INTO edge_node_heartbeats (id, node_id, status, latency_ms, recorded_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(heartbeatId, nodeId, effectiveStatus, latencyMs, nowMs)
    .run();

  await db
    .prepare(
      `UPDATE edge_nodes
       SET status = ?, last_heartbeat_at = ?
       WHERE id = ?`,
    )
    .bind(effectiveStatus, nowMs, nodeId)
    .run();

  return {
    success: true,
    nodeId,
    heartbeatId,
    status: effectiveStatus,
    recordedAt: nowMs,
    latencyMs,
  };
}
