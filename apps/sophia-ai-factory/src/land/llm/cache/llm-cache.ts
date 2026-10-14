/**
 * LLM Cache — Phase 4E exact-match + Phase 4E.2 semantic fallback.
 *
 * D1-backed, env-gated, fire-and-forget dual of `recordLlmCall()`:
 *   - Exact path: SHA-256 of (provider + model + messages + orgId) → hash.
 *   - Semantic path (4E.2): bge-base-en-v1.5 embedding → top-K cosine match.
 *
 * Purge job for expired rows → Phase 4E.3.
 */

import { createServerClient } from '@/seed/db/client';
import {
  EMBEDDING_MODEL_ID,
  embedPrompt,
  encodeEmbedding,
  isSemanticCacheEnabled,
  normalizePromptForEmbedding,
  trySemanticFallback,
} from './llm-cache-semantic';
import {
  isCacheEnabled,
  readTtlSeconds,
  hashCacheKey,
  type CacheKey,
  type CacheEntry,
  type CacheMessage,
  type CacheRow,
} from './llm-cache-types';

export {
  isCacheEnabled,
  readTtlSeconds,
  hashCacheKey,
  isSemanticCacheEnabled,
  type CacheKey,
  type CacheEntry,
  type CacheMessage,
};

/**
 * Read a cached response. Returns null when disabled, missing, expired, or
 * D1 fails. Never throws — cache is best-effort.
 */
export async function lookupCache(key: CacheKey): Promise<CacheEntry | null> {
  if (!isCacheEnabled()) return null;
  // Defense-in-depth: empty orgId could match unscoped rows — reject early
  if (!key.orgId) return null;
  try {
    const hash = await hashCacheKey(key);
    const db = createServerClient();
    const { data, error } = await db
      .from('llm_cache')
      .select('response, input_tokens, output_tokens, cost_usd, expires_at')
      .eq('hash', hash)
      .eq('org_id', key.orgId)
      .single();

    if (error || !data) return await trySemanticFallback(key);
    const row = data as unknown as CacheRow;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return await trySemanticFallback(key);
    }

    void incrementHitCount(hash, key.orgId);

    return {
      response: row.response,
      inputTokens: row.input_tokens ?? undefined,
      outputTokens: row.output_tokens ?? undefined,
      costUsd: row.cost_usd ?? undefined,
    };
  } catch {
    return await trySemanticFallback(key);
  }
}

/**
 * Fire-and-forget hit_count increment via D1 RPC. Never throws.
 */
async function incrementHitCount(hash: string, orgId: string): Promise<void> {
  try {
    const db = createServerClient();
    await db.rpc('increment_llm_cache_hit', { p_hash: hash, p_org_id: orgId });
  } catch {
    // Swallow
  }
}

/**
 * Write a cache entry. Upsert — hot keys get TTL bumped on each write.
 */
export async function writeCache(
  key: CacheKey,
  entry: CacheEntry,
  ttlSeconds: number = readTtlSeconds(),
): Promise<void> {
  if (!isCacheEnabled()) return;
  // Defense-in-depth: never write unscoped rows
  if (!key.orgId) return;
  try {
    const hash = await hashCacheKey(key);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const db = createServerClient();

    let embedding: Uint8Array | null = null;
    let embeddingModel: string | null = null;
    let promptText: string | null = null;
    if (isSemanticCacheEnabled()) {
      const normalized = normalizePromptForEmbedding(key.messages);
      const vec = await embedPrompt(normalized);
      if (vec) {
        embedding = encodeEmbedding(vec);
        embeddingModel = EMBEDDING_MODEL_ID;
        if (process.env.LLM_CACHE_STORE_PROMPT_TEXT === '1') {
          promptText = normalized;
        }
      }
    }

    await db.from('llm_cache').upsert({
      hash,
      org_id: key.orgId,
      provider: key.provider,
      model: key.model,
      response: entry.response,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_usd: entry.costUsd,
      expires_at: expiresAt.toISOString(),
      embedding,
      embedding_model: embeddingModel,
      prompt_text: promptText,
    });
  } catch {
    // Swallow — cache write must never block caller.
  }
}
