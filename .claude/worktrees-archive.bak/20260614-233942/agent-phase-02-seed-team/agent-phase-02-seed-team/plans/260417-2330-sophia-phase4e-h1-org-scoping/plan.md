---
title: "Sophia Phase 4E H-1 — Org Scoping for LLM Semantic Cache"
description: "Add org_id isolation to llm_cache to prevent cross-tenant response leaks."
status: completed
priority: P1
effort: 3.5h
branch: master
tags: [sophia, phase-4e, security, llm-cache, multi-tenant, H-1]
created: 2026-04-17
completed: 2026-04-17
---

# Phase 4E H-1 — Org Scoping

Reviewer **H-1 BLOCKER** on Phase 4E MVP (commit 69fe6a5): cache key is org-agnostic. Same `(provider, model, messages)` collides across tenants. Any caller supplying user-specific prompts can leak tenant A's response to tenant B. Must ship before `lookupCache`/`writeCache` wired into Supervisor / RaaS workflows / direct user-facing LLM calls.

## Current State

- `CacheKey = { provider, model, messages }` — NO `orgId`
- `llm_cache` table — NO `org_id` column
- Only caller: `weekly-signals-digest` cron (system-scope, no user PII — safe for now)
- Tests 1148/1148 green; dashboard 1165/1165
- Env-gated behind `LLM_CACHE_ENABLED=1` (currently off in prod)

## Target State

1. Migration `0009-llm-cache-org-scoping.sql` — `org_id TEXT NOT NULL` + backfill strategy
2. `CacheKey.orgId: string` required field
3. `hashCacheKey` includes `orgId` in normalized JSON (defense-in-depth: even if `WHERE org_id = ?` bypassed, hashes differ)
4. `lookupCache` SELECT filtered by `org_id`
5. `writeCache` upsert includes `org_id`
6. `increment_llm_cache_hit` RPC scoped by `(hash, org_id)` — not just hash
7. Caller `weekly-signals-digest` passes `'system'` sentinel
8. Tests: cross-org isolation, hash divergence by org, migration idempotency

## Phases

| # | File | Est | Status |
|---|------|-----|--------|
| 01 | [phase-01-migration-and-schema.md](./phase-01-migration-and-schema.md) — Migration 0009 + schema change | 45m | ✅ completed |
| 02 | [phase-02-cache-api-orgid.md](./phase-02-cache-api-orgid.md) — `CacheKey.orgId`, `hashCacheKey`, `lookupCache`, `writeCache`, RPC helpers | 90m | ✅ completed |
| 03 | [phase-03-callers-and-tests.md](./phase-03-callers-and-tests.md) — Update `weekly-signals-digest`, add isolation tests, regression | 75m | ✅ completed |

## Key Dependencies

- `@/lib/db/client` → `createServerClient()` (sync)
- `@/lib/db/d1-query-builder.ts` — `incrementLlmCacheHit`, `llmCacheStats` (must accept orgId param)
- `apps/sophia-ai-factory/migrations/0008-llm-cache.sql` — DO NOT modify; additive migration only
- No external deps. YAGNI: no per-org stats split (deferred Phase 4E.4)

## Out of Scope (Deferred)

- Per-org `llm_cache_stats` RPC variant (Phase 4E.4 — dashboard multi-tenancy)
- Semantic similarity cache (Phase 4E.2)
- Expired-row purge job (Phase 4E.3)
- Supervisor / RaaS wiring (unblocked AFTER this ships)

## Success Criteria

- `npm run build` 0 TS errors
- `npm test` — 1148 + N new tests (target ~1156+), all green
- New test: org A `writeCache` → org B `lookupCache` → returns `null`
- New test: `hashCacheKey({orgId: 'a', ...})` ≠ `hashCacheKey({orgId: 'b', ...})`
- Migration idempotent: re-run `0009-llm-cache-org-scoping.sql` = no-op
- Prod: cache still env-gated off → zero behavioural change at deploy time

## Rollback Plan

Cache is rebuildable + currently env-disabled in prod → delete-all rows on migration is safe. If post-deploy regression detected, set `LLM_CACHE_ENABLED=0` via `wrangler secret` — cache fully inert, no code rollback needed.
