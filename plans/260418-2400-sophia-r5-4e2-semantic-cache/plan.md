# Sophia R5 — Phase 4E.2: Semantic similarity cache

**Status:** in progress
**Mode:** `/cook all step by step --auto` (R5 item 3/5)
**Origin:** Phase 4E llm-cache comment "Semantic similarity upgrade → Phase 4E.2"

## Goal

Extend exact-match cache (Phase 4E) with semantic fallback via Workers AI
embedding model. Hot prompts that rephrase slightly still hit cache.

## MVP scope (YAGNI)

- **Exact-match stays fast path** — unchanged hot path, zero regression
- Semantic **only** when exact misses AND feature enabled
- No Vectorize dep; cosine similarity computed in-process over top-K candidates

## New migration

`apps/sophia-ai-factory/migrations/0010-llm-cache-semantic.sql`:
- `embedding BLOB` — Float32Array[768] packed (bge-base-en-v1.5 dim)
- `embedding_model TEXT` — identifies model version
- `prompt_text TEXT` — normalized prompt, for observability
- Index `(org_id, embedding_model, created_at DESC)` for top-K scan

## New wrangler binding

`wrangler.jsonc` adds:
```jsonc
"ai": { "binding": "AI" }
```

## Modified file

`src/lib/llm/cache/llm-cache.ts`:
- `isSemanticCacheEnabled()` — `LLM_CACHE_SEMANTIC_ENABLED === '1'`
- `getAiBinding(): AiBinding | null` — reads `globalThis.AI`; null fallback
- `embedPrompt(messages): Promise<Float32Array | null>` — concat user roles, call `@cf/baai/bge-base-en-v1.5`
- `cosineSimilarity(a, b): number` — dot / (|a| · |b|); pure
- `semanticLookup(key): Promise<CacheEntry | null>` — top-K query by (org_id, embedding_model), cosine ≥ threshold (0.95 default via env `LLM_CACHE_SIMILARITY_THRESHOLD`)
- `lookupCache` falls back to `semanticLookup` on exact miss when enabled
- `writeCache` stores embedding + prompt_text when embedder succeeded

## Tests (+6 expected)

1. `cosineSimilarity`: identical vectors → 1.0
2. `cosineSimilarity`: orthogonal vectors → 0
3. `semanticLookup`: returns null when AI binding missing
4. `semanticLookup`: returns null when all candidates below threshold
5. `semanticLookup`: returns best candidate above threshold (0.97)
6. `lookupCache`: falls through to semantic when exact miss AND enabled

## Env gates (defaults off)

- `LLM_CACHE_ENABLED=1` (existing, required precondition)
- `LLM_CACHE_SEMANTIC_ENABLED=1` (new, gates semantic path)
- `LLM_CACHE_SIMILARITY_THRESHOLD=0.95` (tunable)
- `LLM_CACHE_SEMANTIC_TOP_K=10` (tunable)

## Non-goals

- No Vectorize migration (D1 BLOB is sufficient MVP)
- No OpenAI embedder alternative (only Workers AI path for MVP)
- No rerank — top-K cosine pick, stop
- No admin-visible metrics yet (deferred; existing hit_count still bumps)

## Verification

- `npm run build` → 0 errors
- `npm test` → 1226 → 1232+ (+6)
- File LOC: llm-cache.ts ≤200 after additions
- No regression in existing 4E tests (exact-match fast path untouched)

## Rule #0 post-push

- CI green, CF Pages deploy, HTTP 200, shortSha match
