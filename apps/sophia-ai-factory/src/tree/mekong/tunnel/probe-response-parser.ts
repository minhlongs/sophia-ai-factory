import { createLogger } from '@/seed/utils/logger-utility';
import { verifyAuthTokenHash } from '../crypto';
import type { NodeHealthStatus, MekongHealthResponse } from '../types';

const logger = createLogger('tree/mekong/tunnel/probe');

export async function parseProbeResponse(
  res: Response,
  tunnelUrl: string,
  bearerToken: string,
  elapsed: number,
): Promise<NodeHealthStatus> {
  if (!res.ok) {
    if (res.status === 429 || res.status === 503) {
      return {
        nodeId: tunnelUrl,
        status: 'DEGRADED',
        latencyMs: elapsed,
        reachable: true,
        lastCheckedAt: Date.now(),
        error: `HTTP_${res.status}`,
      };
    }
    return {
      nodeId: tunnelUrl,
      status: 'OFFLINE',
      latencyMs: elapsed,
      reachable: false,
      lastCheckedAt: Date.now(),
      error: `HTTP status ${res.status}: ${res.statusText}`,
    };
  }

  const nodeAckHash = res.headers.get('X-Mekong-Node-Auth-Hash');
  if (nodeAckHash) {
    const isAuthentic = await verifyAuthTokenHash(bearerToken, nodeAckHash);
    if (!isAuthentic) {
      logger.warn('MEKONG_MUTUAL_AUTH_FAILED', {
        tunnelUrl,
        reason: 'Node returned invalid token hash',
      });
      return {
        nodeId: tunnelUrl,
        status: 'OFFLINE',
        latencyMs: elapsed,
        reachable: false,
        lastCheckedAt: Date.now(),
        error: 'Mutual authentication failed: node returned invalid token hash',
      };
    }
  }

  const data = (await res.json().catch(() => ({}))) as Partial<MekongHealthResponse>;

  return {
    nodeId: tunnelUrl,
    status: data.status === 'degraded' ? 'DEGRADED' : 'ONLINE',
    latencyMs: Math.max(1, elapsed),
    reachable: true,
    lastCheckedAt: Date.now(),
    runtime: data.runtime ?? 'mlx',
    version: data.version ?? '0.1.0',
  };
}
