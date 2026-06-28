# Phase 01 — Migration 0009: llm_cache org scoping

## Context Links

- Existing migration: `apps/sophia-ai-factory/migrations/0008-llm-cache.sql`
- Reviewer H-1 BLOCKER (Phase 4E MVP commit `69fe6a5`)
- Plan overview: [plan.md](./plan.md)

## Overview

- **Priority:** P1 (blocks Phase 4F wiring)
- **Status:** pending
- **Description:** Additive migration `0009-llm-cache-org-scoping.sql` adds `org_id TEXT NOT NULL` to `llm_cache`, drops PK → composite `(hash, org_id)`, adds lookup index.

## Key Insights

- D1 (SQLite) cannot `ALTER TABLE … ADD COLUMN … NOT NULL` without DEFAULT. Use the SQLite swap pattern: create new table, copy rows, drop old, rename.
- Cache is rebuildable + env-gated OFF in prod → safe to **DELETE ALL rows** rather than backfill a sentinel. Simplest + safest (YAGNI).
- `hash` alone no longer unique — two orgs may legitimately cache the same normalized prompt. Primary key must become `(hash, org_id)`.
- Keep migration idempotent via `CREATE TABLE IF NOT EXISTS` pattern on new table + guard against re-run (check if `org_id` column exists).

## Requirements

### Functional
- New column `org_id TEXT NOT NULL` on `llm_cache`
- Composite PK `(hash, org_id)`
- Existing index `idx_llm_cache_expires_at` preserved
- New index `idx_llm_cache_org_id_expires_at` on `(org_id, expires_at)` for future per-org purge + stats
- Migration re-runnable without error

### Non-functional
- Zero downtime (env-gated feature, no hot traffic)
- Irreversible data loss of old cache rows is acceptable (rebuildable)
- File <200 lines

## Architecture

### Schema Change

**Before (0008):**
```sql
llm_cache (hash PK, provider, model, response, input_tokens, output_tokens,
           cost_usd, created_at, expires_at, hit_count)
```

**After (0009):**
```sql
llm_cache (hash, org_id, provider, model, response, input_tokens, output_tokens,
           cost_usd, created_at, expires_at, hit_count,
           PRIMARY KEY (hash, org_id))
INDEX idx_llm_cache_expires_at (expires_at)
INDEX idx_llm_cache_org_id_expires_at (org_id, expires_at)
```

### Migration Strategy

SQLite swap pattern (D1-compatible):
1. `DROP TABLE IF EXISTS llm_cache_new`  (clean slate for re-runs)
2. `CREATE TABLE llm_cache_new (...)` with new schema
3. `DROP TABLE IF EXISTS llm_cache`  (delete old rows — acceptable; rebuildable)
4. `ALTER TABLE llm_cache_new RENAME TO llm_cache`
5. Recreate both indexes with `IF NOT EXISTS`

## Related Code Files

**Create:**
- `apps/sophia-ai-factory/migrations/0009-llm-cache-org-scoping.sql`

**Read-only reference:**
- `apps/sophia-ai-factory/migrations/0008-llm-cache.sql` (do NOT modify)

## Implementation Steps

1. Create file `apps/sophia-ai-factory/migrations/0009-llm-cache-org-scoping.sql`
2. Header comment: migration intent, H-1 reference, data-loss acknowledgement
3. `DROP TABLE IF EXISTS llm_cache_new;`
4. `CREATE TABLE llm_cache_new` with all 0008 columns + `org_id TEXT NOT NULL` + composite PK
5. `DROP TABLE IF EXISTS llm_cache;`
6. `ALTER TABLE llm_cache_new RENAME TO llm_cache;`
7. `CREATE INDEX IF NOT EXISTS idx_llm_cache_expires_at ON llm_cache(expires_at);`
8. `CREATE INDEX IF NOT EXISTS idx_llm_cache_org_id_expires_at ON llm_cache(org_id, expires_at);`
9. Verify file <50 lines

## Todo List

- [x] Write migration file with header + swap SQL
- [x] Verify `CREATE TABLE` column order matches 0008 + appends `org_id`
- [x] Verify composite PK declared inline (`PRIMARY KEY (hash, org_id)`)
- [x] Verify both indexes created with `IF NOT EXISTS`
- [x] Local D1 apply: `wrangler d1 execute sophia-prod --file=migrations/0009-llm-cache-org-scoping.sql --local`
- [x] Re-run migration on same DB → confirm no error (idempotent)
- [x] `PRAGMA table_info(llm_cache);` → confirm `org_id NOT NULL`, PK on `hash+org_id`

## Success Criteria

- Migration file compiles in `wrangler d1 execute … --local`
- Re-running on same DB is no-op
- `PRAGMA table_info(llm_cache)` shows `org_id` NOT NULL
- `PRAGMA index_list(llm_cache)` lists both indexes

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prod D1 has real cache rows (env-enabled between ship & migrate) | Low — env flag off | Verify `LLM_CACHE_ENABLED` env var unset in Workers bindings before apply |
| Composite PK breaks existing `upsert` targeting `hash` only | Medium | Phase 02 updates upsert to target `(hash, org_id)` conflict key |
| Migration 0009 applied before Phase 02 code ships | High (runtime errors on any cache write — missing org_id) | Single PR: migration + code + tests atomic; gate merge until all green |
| `DROP TABLE` wipes dashboard history | Low — stats are all-time counters, rebuild in <1 week | Document in changelog |

## Security Considerations

- `org_id NOT NULL` prevents silent empty-string writes that could act as a global bucket (would re-introduce the H-1 leak)
- No RLS on D1; isolation enforced at app layer (`WHERE org_id = ?`) + hash-level defence (Phase 02)
- Migration introduces no secrets; safe to commit

## Next Steps

Phase 02 consumes the new schema: `CacheKey.orgId`, `hashCacheKey` includes orgId, queries add `WHERE org_id = ?`.
