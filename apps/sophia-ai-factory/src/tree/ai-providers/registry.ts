// DEPRECATED: tracked in DEPRECATION_REGISTRY (seed/types/deprecation-markers.ts, target 'tree/ai-providers') — removal eligible after 2026-09-06.
/**
 * AI Provider Registry — D1-backed store for provider configurations.
 *
 * All reads are cached in-memory (50-entry LRU). Writes invalidate cache
 * and persist to D1. Every D1 error is wrapped in AIProviderError.
 *
 * @module tree/ai-providers/registry
 */

import { createServerClient } from '@/seed/db/client'
import { shouldAllowRequest } from '@/seed/security/circuit-breaker'
import { AIProviderError, AIProviderErrorCode } from './errors'
import type {
  AIModel,
  AIProvider,
  AIModelType,
  ProviderRow,
  ProviderStatus,
} from './types'
import {
  cacheGet,
  cacheSet,
  invalidateCache,
  mapRowToProvider,
} from './registry-cache'

export { invalidateCache } from './registry-cache'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a new provider in D1 and cache.
 * Throws AIProviderError on D1 failure.
 */
export async function registerProvider(config: {
  id: string
  workspaceId: string
  name: string
  type: AIModelType
  models: AIModel[]
  status?: ProviderStatus
}): Promise<void> {
  const db = createServerClient()
  const modelsJson = JSON.stringify(config.models)
  const status = config.status ?? 'active'

  try {
    await db
      .prepare(
        `INSERT INTO ai_providers (id, workspace_id, name, type, models_json, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           type = excluded.type,
           models_json = excluded.models_json,
           status = excluded.status`,
      )
      .bind(config.id, config.workspaceId, config.name, config.type, modelsJson, status)
      .run()
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to register provider: ${String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    )
  }

  const row: ProviderRow = {
    id: config.id, workspace_id: config.workspaceId, name: config.name,
    type: config.type, models_json: modelsJson, status,
  }
  cacheSet(config.id, mapRowToProvider(row))
}

/**
 * Get a single provider by ID. Throws AIProviderError if not found.
 */
export async function getProvider(id: string, workspaceId: string): Promise<AIProvider> {
  const cacheKey = `${workspaceId}:${id}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const db = createServerClient()
  let row: ProviderRow | undefined

  try {
    const result = await db
      .prepare('SELECT * FROM ai_providers WHERE id = ?1 AND workspace_id = ?2')
      .bind(id, workspaceId)
      .first<ProviderRow>()
    row = result ?? undefined
  } catch (err) {
    throw new AIProviderError(
      AIProviderErrorCode.D1_UNAVAILABLE,
      `Failed to read provider ${id}: ${String(err)}`,
      { providerId: id, cause: err instanceof Error ? err : undefined },
    )
  }

  if (!row) {
    throw new AIProviderError(AIProviderErrorCode.PROVIDER_NOT_FOUND, `Provider ${id} not found`, { providerId: id })
  }

  const provider = mapRowToProvider(row)
  cacheSet(cacheKey, provider)
  return provider
}

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
