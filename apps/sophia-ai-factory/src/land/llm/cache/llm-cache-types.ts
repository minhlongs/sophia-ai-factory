/**
 * LLM Cache type contracts and configuration helpers.
 *
 * @module land/llm/cache/llm-cache-types
 */

import { createServerClient } from '@/seed/db/client';

export const DEFAULT_TTL_SEC = 24 * 60 * 60;

export interface CacheMessage {
  role: string;
  content: string;
}

export interface CacheKey {
  provider: string;
  model: string;
  messages: CacheMessage[];
  /** Tenant scope. Use `'system'` for server-side crons with no user context. */
  orgId: string;
}

export interface CacheEntry {
  response: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface CacheRow {
  response: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  expires_at: string;
}

/**
 * True iff `LLM_CACHE_ENABLED=1`. Dark-launched otherwise — every helper
 * short-circuits and the module is inert. Same pattern as Phase 4D Langfuse.
 */
export function isCacheEnabled(): boolean {
  return process.env.LLM_CACHE_ENABLED === '1';
}

/**
 * Read TTL from env or default to 24h. Invalid / zero / negative → default.
 */
export function readTtlSeconds(): number {
  const raw = Number(process.env.LLM_CACHE_TTL_SECONDS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_TTL_SEC;
}

/**
 * SHA-256 of a deterministic JSON encoding of `{provider, model, messages}`.
 */
export async function hashCacheKey(key: CacheKey): Promise<string> {
  const normalized = `orgId:${key.orgId}|` + JSON.stringify({
    provider: key.provider,
    model: key.model,
    messages: key.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Fire-and-forget hit_count increment via D1 RPC. Never throws.
 */
export async function incrementHitCount(hash: string, orgId: string): Promise<void> {
  try {
    const db = createServerClient();
    await db.rpc('increment_llm_cache_hit', { p_hash: hash, p_org_id: orgId });
  } catch {
    // Swallow
  }
}
