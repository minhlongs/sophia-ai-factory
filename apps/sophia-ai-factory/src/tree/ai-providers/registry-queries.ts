/**
 * AI Provider Registry Queries — list and availability lookup.
 *
 * @module tree/ai-providers/registry-queries
 */

import { createServerClient } from '@/seed/db/client'
import { shouldAllowRequest } from '@/seed/security/circuit-breaker'
import { AIProviderError, AIProviderErrorCode } from './errors'
import type {
  AIProvider,
  AIModelType,
  ProviderRow,
} from './types'
import { mapRowToProvider } from './registry-cache'

/**
 * List all providers (optionally filtered by workspace).
 */
export async function listProviders(workspaceId?: string): Promise<AIProvider[]> {
  const db = createServerClient()

  try {
    const query = workspaceId
      ? 'SELECT * FROM ai_providers WHERE workspace_id = ?1'
      : 'SELECT * FROM ai_providers'
    const params = workspaceId ? [workspaceId] : []

    const result = await db.prepare(query).bind(...params).all<ProviderRow>()
    return result.results.map(mapRowToProvider)
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to list providers: ${String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }
}

/**
 * Find the first available provider of the given type.
 * A provider is available when: status === 'active' AND circuit breaker allows it.
 */
export async function getAvailableProvider(
  type: AIModelType,
  workspaceId?: string,
): Promise<AIProvider | null> {
  const providers = await listProviders(workspaceId)
  for (const provider of providers) {
    if (provider.type !== type) continue
    if (provider.status !== 'active') continue
    if (!shouldAllowRequest(provider.id)) continue
    return provider
  }
  return null
}
