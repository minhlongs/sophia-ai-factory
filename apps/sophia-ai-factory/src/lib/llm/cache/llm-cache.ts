/**
 * LLM Cache — Phase 4E exact-match MVP (PDF Bước 4.6 Semantic Cache).
 *
 * D1-backed, env-gated, fire-and-forget dual of `recordLlmCall()`:
 * hash = SHA-256 of normalized (provider + model + messages).
 *
 * Semantic similarity upgrade (embedding-based top-K) → Phase 4E.2.
 * Purge job for expired rows                         → Phase 4E.3.
 */

import { createServerClient } from '@/lib/db/client'

const DEFAULT_TTL_SEC = 24 * 60 * 60

export interface CacheMessage {
  role:    string
  content: string
}

export interface CacheKey {
  provider: string
  model:    string
  messages: CacheMessage[]
  /** Tenant scope. Use `'system'` for server-side crons with no user context. */
  orgId:    string
}

export interface CacheEntry {
  response:      string
  inputTokens?:  number
  outputTokens?: number
  costUsd?:      number
}

interface CacheRow {
  response:      string
  input_tokens:  number | null
  output_tokens: number | null
  cost_usd:      number | null
  expires_at:    string
}

/**
 * True iff `LLM_CACHE_ENABLED=1`. Dark-launched otherwise — every helper
 * short-circuits and the module is inert. Same pattern as Phase 4D Langfuse.
 */
export function isCacheEnabled(): boolean {
  return process.env.LLM_CACHE_ENABLED === '1'
}

/**
 * Read TTL from env or default to 24h. Invalid / zero / negative → default.
 */
export function readTtlSeconds(): number {
  const raw = Number(process.env.LLM_CACHE_TTL_SECONDS)
  if (Number.isFinite(raw) && raw > 0) return raw
  return DEFAULT_TTL_SEC
}

/**
 * SHA-256 of a deterministic JSON encoding of `{provider, model, messages}`.
 *
 * Message order and content preserved verbatim — swapping two messages or
 * changing a single character yields a different hash (correctness: cache
 * must never return a response for a materially different prompt).
 */
export async function hashCacheKey(key: CacheKey): Promise<string> {
  // orgId prefix ensures cross-tenant hash divergence even before WHERE clause
  const normalized = `orgId:${key.orgId}|` + JSON.stringify({
    provider: key.provider,
    model:    key.model,
    messages: key.messages.map((m) => ({ role: m.role, content: m.content })),
  })
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Read a cached response. Returns null when disabled, missing, expired, or
 * D1 fails. Never throws — cache is best-effort.
 *
 * On fresh hit: fire-and-forget UPDATE hit_count += 1 (Phase 4E M-2 close —
 * powers the admin monitoring dashboard; swallow-all-errors).
 */
export async function lookupCache(key: CacheKey): Promise<CacheEntry | null> {
  if (!isCacheEnabled()) return null
  // Defense-in-depth: empty orgId could match unscoped rows — reject early
  if (!key.orgId) return null
  try {
    const hash = await hashCacheKey(key)
    const db = createServerClient()
    const { data, error } = await db
      .from('llm_cache')
      .select('response, input_tokens, output_tokens, cost_usd, expires_at')
      .eq('hash', hash)
      .eq('org_id', key.orgId)
      .single()

    if (error || !data) return null
    const row = data as CacheRow

    if (new Date(row.expires_at).getTime() <= Date.now()) return null

    void incrementHitCount(hash, key.orgId)

    return {
      response:     row.response,
      inputTokens:  row.input_tokens  ?? undefined,
      outputTokens: row.output_tokens ?? undefined,
      costUsd:      row.cost_usd      ?? undefined,
    }
  } catch {
    return null
  }
}

/**
 * Fire-and-forget hit_count increment via D1 RPC. Never throws — hit_count is
 * telemetry for the admin dashboard; a failure must not break a cache hit.
 */
async function incrementHitCount(hash: string, orgId: string): Promise<void> {
  try {
    const db = createServerClient()
    await db.rpc('increment_llm_cache_hit', { p_hash: hash, p_org_id: orgId })
  } catch {
    // Swallow
  }
}

/**
 * Write a cache entry. Upsert — hot keys get TTL bumped on each write.
 * Swallows all errors (network, D1, serialization). Never throws.
 */
export async function writeCache(
  key:        CacheKey,
  entry:      CacheEntry,
  ttlSeconds: number = readTtlSeconds(),
): Promise<void> {
  if (!isCacheEnabled()) return
  // Defense-in-depth: never write unscoped rows
  if (!key.orgId) return
  try {
    const hash = await hashCacheKey(key)
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    const db = createServerClient()

    // Upsert keeps existing hit_count + created_at untouched on update
    // (those cols are not in the payload, so ON CONFLICT DO UPDATE skips them).
    await db.from('llm_cache').upsert({
      hash,
      org_id:        key.orgId,
      provider:      key.provider,
      model:         key.model,
      response:      entry.response,
      input_tokens:  entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_usd:      entry.costUsd,
      expires_at:    expiresAt.toISOString(),
    })
  } catch {
    // Swallow — cache write must never block caller.
  }
}
