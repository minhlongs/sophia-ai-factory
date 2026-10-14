/**
 * Semantic cache helpers — Phase 4E.2.
 *
 * Runs only when `LLM_CACHE_SEMANTIC_ENABLED=1` AND Workers AI binding is
 * present. Every function short-circuits gracefully when either is missing
 * so the caller path stays best-effort (identical to Phase 4E semantics).
 *
 * Contract:
 *   - embedPrompt: user-role messages concatenated → Float32Array[768]
 *   - cosineSimilarity: pure math; no side effects
 *   - semanticLookup: top-K candidates filtered by (org_id, embedding_model),
 *                     best cosine wins if ≥ threshold
 */

import { createServerClient } from '@/seed/db/client'
import type { CacheEntry, CacheKey } from './llm-cache'
import {
  EMBEDDING_MODEL_ID,
  normalizePromptForEmbedding,
  embedPrompt,
  cosineSimilarity,
  decodeEmbedding,
  type CandidateRow,
} from './llm-cache-semantic-helpers'

export {
  EMBEDDING_MODEL_ID,
  getAiBinding,
  normalizePromptForEmbedding,
  embedPrompt,
  cosineSimilarity,
  encodeEmbedding,
  decodeEmbedding,
  type AiRunResult,
  type AiBinding,
  type CandidateRow,
} from './llm-cache-semantic-helpers'

const DEFAULT_SIMILARITY_THRESHOLD = 0.95
const DEFAULT_SEMANTIC_TOP_K       = 10

export function isSemanticCacheEnabled(): boolean {
  return process.env.LLM_CACHE_SEMANTIC_ENABLED === '1'
}

function readSimilarityThreshold(): number {
  const raw = Number(process.env.LLM_CACHE_SIMILARITY_THRESHOLD)
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw
  return DEFAULT_SIMILARITY_THRESHOLD
}

function readSemanticTopK(): number {
  const raw = Number(process.env.LLM_CACHE_SEMANTIC_TOP_K)
  if (Number.isFinite(raw) && raw > 0 && raw <= 100) return Math.floor(raw)
  return DEFAULT_SEMANTIC_TOP_K
}

/**
 * Phase 4E.2 entry point: called on exact miss. Gated + orgId-scoped.
 */
export async function trySemanticFallback(key: CacheKey): Promise<CacheEntry | null> {
  if (!isSemanticCacheEnabled()) return null
  if (!key.orgId) return null
  return semanticLookup(key, readSimilarityThreshold(), readSemanticTopK())
}

/**
 * Top-K semantic lookup. Returns best candidate's CacheEntry iff cosine
 * ≥ threshold, else null. All errors swallowed — cache is best-effort.
 */
export async function semanticLookup(
  key:       CacheKey,
  threshold: number,
  topK:      number,
): Promise<CacheEntry | null> {
  const queryVec = await embedPrompt(normalizePromptForEmbedding(key.messages))
  if (!queryVec) return null

  try {
    const db = createServerClient()
    const { data, error } = await db
      .from('llm_cache')
      .select('hash, response, input_tokens, output_tokens, cost_usd, expires_at, embedding')
      .eq('org_id', key.orgId)
      .eq('embedding_model', EMBEDDING_MODEL_ID)
      .eq('provider', key.provider)
      .eq('model', key.model)
      .order('created_at', { ascending: false })
      .limit(topK)

    if (error || !data) return null
    const rows = data as unknown as CandidateRow[]

    const now = Date.now()
    let best: { score: number; row: CandidateRow } | null = null
    for (const row of rows) {
      if (!row.embedding) continue
      if (new Date(row.expires_at).getTime() <= now) continue
      const candVec = decodeEmbedding(row.embedding)
      const score   = cosineSimilarity(queryVec, candVec)
      if (score >= threshold && (!best || score > best.score)) {
        best = { score, row }
      }
    }
    if (!best) return null

    return {
      response:     best.row.response,
      inputTokens:  best.row.input_tokens  ?? undefined,
      outputTokens: best.row.output_tokens ?? undefined,
      costUsd:      best.row.cost_usd      ?? undefined,
    }
  } catch {
    return null
  }
}
