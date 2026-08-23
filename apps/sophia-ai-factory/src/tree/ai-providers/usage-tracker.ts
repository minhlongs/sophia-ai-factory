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
import type {
  AIResponse,
  DateRange,
  UsageRecord,
  UsageRow,
  UsageSummary,
} from './types'

// ── Row → Domain Mapping ──────────────────────────────────────────────────────

function mapUsageRow(row: UsageRow): UsageRecord {
  return {
    requestId: row.request_id,
    providerId: row.provider_id,
    workspaceId: row.workspace_id,
    model: row.model,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costCents: row.cost_cents,
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  }
}

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

/**
 * Get usage summary for a specific provider within a date range.
 */
export async function getUsageByProvider(
  providerId: string,
  dateRange: DateRange,
): Promise<UsageSummary> {
  const db = createServerClient()

  try {
    const result = await db
      .prepare(
        `SELECT
           provider_id,
           COUNT(*) AS total_requests,
           COALESCE(SUM(tokens_in), 0) AS total_tokens_in,
           COALESCE(SUM(tokens_out), 0) AS total_tokens_out,
           COALESCE(SUM(cost_cents), 0) AS total_cost_cents,
           COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
         FROM ai_usage
         WHERE provider_id = ?1
           AND created_at >= ?2
           AND created_at <= ?3
         GROUP BY provider_id`,
      )
      .bind(providerId, dateRange.from, dateRange.to)
      .first<{
        provider_id: string
        total_requests: number
        total_tokens_in: number
        total_tokens_out: number
        total_cost_cents: number
        avg_latency_ms: number
      }>()

    if (!result) {
      return {
        providerId,
        totalRequests: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostCents: 0,
        avgLatencyMs: 0,
      }
    }

    return {
      providerId: result.provider_id,
      totalRequests: result.total_requests,
      totalTokensIn: result.total_tokens_in,
      totalTokensOut: result.total_tokens_out,
      totalCostCents: result.total_cost_cents,
      avgLatencyMs: Math.round(result.avg_latency_ms),
    }
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to get usage for provider ${providerId}: ${String(err)}`,
      { providerId, cause: err instanceof Error ? err : undefined },
    )
  }
}

/**
 * Get total cost in cents across all providers for a workspace within a date range.
 */
export async function getTotalCostCents(
  workspaceId: string,
  dateRange: DateRange,
): Promise<number> {
  const db = createServerClient()

  try {
    const result = await db
      .prepare(
        `SELECT COALESCE(SUM(cost_cents), 0) AS total_cost
         FROM ai_usage
         WHERE workspace_id = ?1
           AND created_at >= ?2
           AND created_at <= ?3`,
      )
      .bind(workspaceId, dateRange.from, dateRange.to)
      .first<{ total_cost: number }>()

    return result?.total_cost ?? 0
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to get total cost for workspace ${workspaceId}: ${String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }
}
