// DEPRECATED: tracked in DEPRECATION_REGISTRY (seed/types/deprecation-markers.ts, target 'tree/ai-providers') — removal eligible after 2026-09-06.
/**
 * AI Provider Usage Tracking — D1-backed cost and token tracking.
 *
 * Records per-request usage and aggregates by provider and workspace.
 * All D1 errors are wrapped in AIProviderError.
 *
 * @module tree/ai-providers/usage-tracker
 */

import { createServerClient } from '@/seed/db/client'
import { AIProviderError, AIProviderErrorCode } from './errors'
import type { AIResponse } from './types'

export { getUsageByProvider, getTotalCostCents } from './usage-queries'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a completed AI response in the usage table.
 * @param requestId  - unique ID for this request
 * @param response   - AI response with cost/token data
 * @param workspaceId - workspace this usage belongs to
 */
export async function recordUsage(
  requestId: string,
  response: AIResponse,
  workspaceId: string,
): Promise<void> {
  const db = createServerClient()

  try {
    await db
      .prepare(
        `INSERT INTO ai_usage (request_id, provider_id, workspace_id, model, tokens_in, tokens_out, cost_cents, latency_ms, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        requestId,
        response.providerId,
        workspaceId,
        response.modelUsed,
        response.tokensIn,
        response.tokensOut,
        response.costCents,
        response.latencyMs,
        Date.now(),
      )
      .run()
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to record usage for request ${requestId}: ${String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }
}
