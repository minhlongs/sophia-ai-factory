# Sophia Phase 4E — LLM Semantic Cache (Exact-Match MVP)

**Source:** PDF Solo Platform Bước 4.6 "Semantic Cache – Redis-based caching giảm 40-60% token usage".
**Status:** in_progress 2026-04-17 PM-11.
**Builds on:** Phase 4B `recordLlmCall()` + Phase 4C router + Phase 4D Langfuse sink.
**Unblocks:** first-step token cost reduction; future semantic similarity upgrade (embeddings).

## Scope (YAGNI/KISS)

**MVP = exact-match SHA-256 hash cache**, D1-backed, env-gated dark-launch. Semantic (embedding) similarity = Phase 4E.2. Redis on CF edge = wrong fit (no native binding); D1 is already primary store.

Wire into ONE call site (weekly-signals-digest cron) — lowest risk, scheduled repeatability proves E2E. Remaining call sites (affiliate enhancer, local mekongd adapter) = opt-in migration post-bake.

## Files

- NEW `migrations/0008-llm-cache.sql` (~20 LOC)
  - `llm_cache` table: `hash TEXT PK`, `provider`, `model`, `response TEXT`, `input_tokens`, `output_tokens`, `cost_usd REAL`, `created_at`, `expires_at`, `hit_count INT DEFAULT 0`
  - Index on `expires_at` for eventual purge job
- NEW `src/lib/llm/cache/llm-cache.ts` (~140 LOC)
  - `hashCacheKey(key)` — SHA-256 via `crypto.subtle.digest`, normalize provider+model+messages to deterministic JSON
  - `isCacheEnabled()` — `process.env.LLM_CACHE_ENABLED === '1'`
  - `lookupCache(key)` — D1 read, TTL check, swallow errors → null
  - `writeCache(key, entry, ttlSeconds?)` — D1 insert-or-ignore, swallow errors
  - Default TTL 24h, overridable via `LLM_CACHE_TTL_SECONDS`
- NEW `src/lib/llm/cache/llm-cache.test.ts` (~15 tests)
  - Hash determinism + order sensitivity + provider/model scoping
  - Env-gate off → null / no write
  - D1 hit within TTL
  - D1 miss on expired row
  - D1 error swallowed → null
  - TTL override
  - Empty LANGFUSE pattern reuse
- MOD `src/app/api/cron/weekly-signals-digest/route.ts`
  - Wrap OpenRouter call in `summarizeWithAI()` — pre-fetch cache, write after success

## Design decisions

- **D1, not Redis:** Sophia runs serverless edge (CF Workers). D1 is native, already wired, cheap for weekly cron volumes. Redis = separate infra with CF Hyperdrive cost.
- **Exact-match before semantic:** Semantic requires embedding model (another LLM call), adding dependency + failure mode. Exact-match delivers 100% value for deterministic prompts (cron jobs, fixed templates). Semantic upgrade is additive.
- **Scope hash by provider+model+messages:** Different model → different response; mixing = correctness bug. Hash deterministic JSON of `{provider, model, messages[{role,content}]}`. Order matters.
- **Fire-and-forget writes:** Cache write failure must never break LLM flow. Try/catch inside `writeCache`, caller never awaits.
- **TTL via stored `expires_at`:** Compared at read time (not DB CRON cleanup). Old rows stay until purge job — deferred to Phase 4E.3.
- **Env-gated dark launch:** `LLM_CACHE_ENABLED=1` else entire module inert. Zero risk to production until founder activates.
- **Insert-or-ignore on conflict:** `INSERT OR IGNORE` avoids race condition where two concurrent calls both write same hash.

## Success criteria

- [ ] Hash determinism proven (same input → same hash across runs)
- [ ] 15+ targeted tests pass (llm-cache.test.ts)
- [ ] Full Sophia vitest 1123+N/1123+N pass
- [ ] `npm run build` compiles clean in < 15s
- [ ] Zero `:any`, zero `console.log`, zero new deps
- [ ] All new files < 200 LOC
- [ ] Code review ≥ 9.5/10
- [ ] Binh Pháp Rule #0: CI green + CF Pages deploy + prod HTTP 200 + shortSha match
- [ ] Cache activation `LLM_CACHE_ENABLED=1` via `wrangler secret put` = **manual founder action post-merge** (not in code)

## Deferred (follow-up PRs)

- **Phase 4E.2 Semantic similarity** — embedding-based lookup via cheap model (text-embedding-3-small) when exact-match miss → top-K cosine similarity over cached embeddings.
- **Phase 4E.3 Purge job** — daily cron deletes `expires_at < now()`.
- **LLM_CACHE_HIT / LLM_CACHE_MISS D1 signals** — observability of cost savings.
- **Cache wiring at remaining call sites** — `affiliate-openrouter-niche-enhancer.ts`, `local-mekongd-adapter.ts`, Supervisor agent LLM calls.
- **Cost-saved dashboard** — aggregate `sum(cost_usd) WHERE hit_count > 0` weekly.
