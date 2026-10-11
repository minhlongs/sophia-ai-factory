/**
 * Edge Node Query and Health Validation
 * Layer: tree/mekong/router
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { EdgeNodeRecord, FallbackReason } from '../types'
import { logger } from './fallback'

export function isD1Database(obj: unknown): obj is D1Database {
  return typeof obj === 'object' && obj !== null && 'prepare' in obj
}

export function resolveRouterArgs(
  arg2?: D1Database | string,
  arg3?: string | D1Database,
): { db?: D1Database; preferredNodeId?: string } {
  if (isD1Database(arg2)) {
    return { db: arg2, preferredNodeId: typeof arg3 === 'string' ? arg3 : undefined }
  }
  if (typeof arg2 === 'string') {
    return { preferredNodeId: arg2, db: isD1Database(arg3) ? arg3 : undefined }
  }
  if (isD1Database(arg3)) {
    return { db: arg3 }
  }
  return {}
}

export async function queryTargetNode(
  db: D1Database,
  preferredNodeId?: string,
): Promise<{ node?: EdgeNodeRecord; notFoundReason?: FallbackReason; message?: string }> {
  if (preferredNodeId) {
    const node = await db
      .prepare(
        'SELECT id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at FROM edge_nodes WHERE id = ?',
      )
      .bind(preferredNodeId)
      .first<EdgeNodeRecord>()

    if (!node) {
      return {
        notFoundReason: 'PREFERRED_NODE_NOT_FOUND',
        message: `Preferred node ${preferredNodeId} not found in registry`,
      }
    }
    return { node }
  }

  const node = await db
    .prepare(
      "SELECT id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at FROM edge_nodes WHERE UPPER(status) = 'ONLINE' ORDER BY last_heartbeat_at DESC LIMIT 1",
    )
    .first<EdgeNodeRecord>()

  if (!node) {
    return {
      notFoundReason: 'NO_ONLINE_NODE',
      message: 'No nodes currently registered with status ONLINE',
    }
  }
  return { node }
}

export async function validateEdgeNodeHealth(
  db: D1Database,
  targetNode: EdgeNodeRecord,
  nowMs: number,
  heartbeatThreshold: number,
): Promise<{ valid: boolean; reason?: FallbackReason; message?: string }> {
  const normalizedStatus = (targetNode.status || '').toUpperCase()
  if (normalizedStatus !== 'ONLINE') {
    return {
      valid: false,
      reason: 'NODE_OFFLINE',
      message: `Target node ${targetNode.id} status is ${targetNode.status}`,
    }
  }

  const stalenessMs = nowMs - Number(targetNode.last_heartbeat_at || 0)
  if (stalenessMs > heartbeatThreshold) {
    await db
      .prepare("UPDATE edge_nodes SET status = 'OFFLINE' WHERE id = ?")
      .bind(targetNode.id)
      .run()
      .catch((err) =>
        logger.warn('Failed to lazily mark stale node OFFLINE', {
          nodeId: targetNode?.id,
          error: String(err),
        }),
      )

    return {
      valid: false,
      reason: 'STALE_HEARTBEAT',
      message: `Node ${targetNode.id} heartbeat stale by ${stalenessMs}ms (> ${heartbeatThreshold}ms)`,
    }
  }

  if (
    targetNode.tunnel_url.includes('offline') ||
    targetNode.tunnel_url.includes('unreachable')
  ) {
    return {
      valid: false,
      reason: 'PROBE_FAILED',
      message: 'Tunnel URL marked unreachable',
    }
  }

  return { valid: true }
}
