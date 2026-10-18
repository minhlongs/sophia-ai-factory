/**
 * Heartbeat Telemetry Resolution & Hardware Pressure Status Evaluator
 *
 * @module tree/mekong/health-checker/heartbeat-telemetry-resolver
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { decryptPayload } from '../crypto';
import type {
  EdgeNodeStatus,
  EncryptedPayloadEnvelope,
  MekongHeartbeatTelemetry,
} from './types';

const logger = createLogger('tree/mekong/health-checker/heartbeat-telemetry-resolver');

export async function resolveHeartbeatTelemetry(
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

export function computeEffectiveNodeStatus(
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
