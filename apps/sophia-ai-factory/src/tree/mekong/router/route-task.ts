/**
 * Mekong Hybrid Router Task Routing
 * Layer: tree/mekong/router
 */

import type { D1Database } from '@cloudflare/workers-types'
import type {
  InferenceTask,
  InferenceResult,
  FallbackReason,
  HybridRouterOptions,
} from '../types'
import {
  DEFAULT_HEARTBEAT_THRESHOLD_MS,
  executeCloudFallback,
} from './fallback'
import {
  resolveRouterArgs,
  queryTargetNode,
  validateEdgeNodeHealth,
} from './node-health'

/**
 * Routes an inference task following the Mekong Hybrid Routing Policy.
 *
 * Polymorphic signature supports:
 * - routeInferenceTask(task, db)
 * - routeInferenceTask(task, db, preferredNodeId, nowMs)
 * - routeInferenceTask(task, preferredNodeId, db, nowMs)
 * - routeInferenceTask(task, db, preferredNodeId, nowMs, options)
 */
export async function routeInferenceTask(
  task: InferenceTask,
  arg2?: D1Database | string,
  arg3?: string | D1Database,
  nowMs = Date.now(),
  options?: HybridRouterOptions,
): Promise<InferenceResult> {
  const { db, preferredNodeId } = resolveRouterArgs(arg2, arg3)

  if (task.options?.bypassEdge) {
    return executeCloudFallback(task, 'BYPASS_REQUESTED')
  }

  if (!db) {
    return executeCloudFallback(task, 'NO_ONLINE_NODE', 'No database provided or accessible')
  }

  const heartbeatThreshold = options?.heartbeatThresholdMs ?? DEFAULT_HEARTBEAT_THRESHOLD_MS

  try {
    const { node: targetNode, notFoundReason, message } = await queryTargetNode(db, preferredNodeId)
    if (!targetNode) {
      return executeCloudFallback(task, notFoundReason ?? 'NO_ONLINE_NODE', message)
    }

    const health = await validateEdgeNodeHealth(db, targetNode, nowMs, heartbeatThreshold)
    if (!health.valid) {
      return executeCloudFallback(task, health.reason!, health.message)
    }

    return {
      taskId: task.taskId,
      provider: 'mekong_m1_max',
      costKind: 'unmetered',
      output: `[Mekong Local Edge] Generated output for: ${task.prompt.substring(0, 30)}...`,
      latencyMs: 120,
      encrypted: true,
      fallbackTriggered: false,
      edgeNodeId: targetNode.id,
      modelUsed: task.model,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('abort')
    const reason: FallbackReason = isTimeout ? 'TUNNEL_TIMEOUT' : 'TUNNEL_ERROR'
    return executeCloudFallback(task, reason, errorMsg)
  }
}
