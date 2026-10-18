/**
 * Health Telemetry Aggregation & Ingestion Engine for Mekong Edge Nodes
 *
 * @module tree/mekong/health-checker/health-aggregator
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '@/seed/utils/logger-utility';
import {
  computeEffectiveNodeStatus,
  resolveHeartbeatTelemetry,
} from './heartbeat-telemetry-resolver';
import type {
  HeartbeatIngestionResult,
  InboundHeartbeatRequest,
} from './types';

const logger = createLogger('tree/mekong/health-checker/health-aggregator');

/**
 * Ingests and records inbound heartbeat telemetry from mekongd daemon.
 */
export async function processNodeHeartbeat(
  db: D1Database,
  request: InboundHeartbeatRequest,
  nowMs = Date.now(),
): Promise<HeartbeatIngestionResult> {
  const { nodeId, bearerToken, encryptedPayload, telemetry: rawTelemetry, reportedStatus } = request;

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
  const effectiveStatus = computeEffectiveNodeStatus(reportedStatus, telemetry);
  const latencyMs = Number(telemetry.latencyMs ?? 10.0);
  const heartbeatId = `hb_${nodeId}_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;

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
