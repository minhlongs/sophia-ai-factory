/**
 * AI Provider Usage Queries — D1 aggregation queries by provider and workspace.
 *
 * @module tree/ai-providers/usage-queries
 */

import { createServerClient } from '@/seed/db/client'
import { AIProviderError, AIProviderErrorCode } from './errors'
import type { DateRange, UsageSummary } from './types'

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
