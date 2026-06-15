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

export const EMBEDDING_MODEL_ID            = '@cf/baai/bge-base-en-v1.5'
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

interface AiRunResult {
  data?: number[][]
}

interface AiBinding {
  run: (model: string, input: { text: string | string[] }) => Promise<AiRunResult>
}

interface CandidateRow {
  hash:          string
  response:      string
  input_tokens:  number | null
  output_tokens: number | null
  cost_usd:      number | null
  expires_at:    string
  embedding:     ArrayBuffer | Uint8Array | null
}

export function getAiBinding(): AiBinding | null {
  const binding = (globalThis as unknown as { AI?: AiBinding }).AI
  return binding && typeof binding.run === 'function' ? binding : null
}

/**
 * Concatenate user-role message content into a single embeddable string.
 * Caller order preserved — rephrasing a single message still hits.
 */
export function normalizePromptForEmbedding(messages: CacheKey['messages']): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n\n')
    .slice(0, 8192)  // bge-base max context ≈ 512 tokens; hard-cap chars
}

const EMBED_TIMEOUT_MS = 5000

export async function embedPrompt(text: string): Promise<Float32Array | null> {
  const ai = getAiBinding()
  if (!ai) return null
  if (!text.trim()) return null
  try {
    // Timeout guard (M-1): AI binding call must not block writeCache indefinitely.
    // 5s is well above p99 latency (~80ms) — trips only on hard infra issues.
    const embedResult = Promise.race([
      ai.run(EMBEDDING_MODEL_ID, { text }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('EMBED_TIMEOUT')), EMBED_TIMEOUT_MS),
      ),
    ])
    const result = await embedResult as AiRunResult
    const vec = result.data?.[0]
    if (!Array.isArray(vec) || vec.length === 0) return null
    return Float32Array.from(vec)
  } catch {
    return null
  }
}

/**
 * Cosine similarity for L2-unnormalized vectors. Returns value in [-1, 1].
 * Returns 0 when either vector has zero magnitude or lengths differ.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, aMag = 0, bMag = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    aMag += a[i] * a[i]
    bMag += b[i] * b[i]
  }
  if (aMag === 0 || bMag === 0) return 0
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag))
}

export function encodeEmbedding(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength)
}

export function decodeEmbedding(bytes: ArrayBuffer | Uint8Array): Float32Array {
  const buf = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes
  return new Float32Array(buf)
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
