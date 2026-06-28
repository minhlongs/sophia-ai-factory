---
phase: 04
title: "Add (provider, status) composite index on publishing_jobs"
priority: P3/LOW/PERF
status: complete
effort_estimate: 0.5h
effort_actual: ~10m
completed: 2026-05-10
migration: 0103-publishing-jobs-provider-status-index.sql
dependencies: []
---

# Phase 04 — publishing_jobs(provider, status) Index

## Context Links

- W20 review finding #5: `plans/260510-0115-wave21-hardening-and-docs/reports/code-reviewer-wave20-2026-05-10.md` lines 50–54
- Migration that introduced `provider`: `migrations/0099-publishing-jobs-add-provider.sql`
- Rename migration W20 P05: `migrations/0101-publishing-jobs-rename-video-job-id-to-video-id.sql`
- Hot query path: `src/forest/inngest/functions/publish-execute.ts` (token refresh cron filters by `provider='telegram'`)

## Goal

Add composite index `(provider, status)` on `publishing_jobs` to avoid full-table scan when filtering Telegram-specific publishing jobs by status. Pre-emptive scaling fix; current scale (<1K rows) doesn't bite, but indexed by 10K+ jobs.

## Key Insights

1. **Existing indexes on `publishing_jobs`** (verify before phase): likely `(tenant_id)`, `(status)`. Composite `(provider, status)` enables `WHERE provider='telegram' AND status='pending'` index-only scan.
2. **Index ordering matters for D1/SQLite:** `(provider, status)` (low cardinality first) supports both:
   - `WHERE provider=?` (uses leading column)
   - `WHERE provider=? AND status=?` (uses both)
   - But NOT `WHERE status=?` alone. That's served by existing single-column index.
3. **Idempotent migration** — `CREATE INDEX IF NOT EXISTS` safe to re-apply.

## Architecture

No code change. Pure DB index addition.

## Files to Create

| File | Purpose |
|---|---|
| `migrations/0104-publishing-jobs-provider-status-index.sql` | Composite index DDL |

## Files to Modify

None.

## Migration

```sql
-- migrations/0104-publishing-jobs-provider-status-index.sql
-- Wave 22 Phase 04 — Optimize hot filter (provider='telegram' AND status=...)
-- Used by Inngest token-refresh cron + publish-execute job lookups.

CREATE INDEX IF NOT EXISTS idx_pub_jobs_provider_status
  ON publishing_jobs(provider, status);
```

## Implementation Steps

1. **Verify existing indexes** before creating new:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote \
     --command "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='publishing_jobs'"
   ```
2. **Confirm no duplicate** `(provider, status)` index exists.
3. **Create migration file** `migrations/0104-publishing-jobs-provider-status-index.sql`.
4. **Apply locally** via wrangler (if dev D1 used) or skip (D1 dev is Miniflare in-memory).
5. **Apply remote**: `bash scripts/apply-migrations.sh` (auto-detects new file).
6. **Verify created**:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote \
     --command "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pub_jobs_provider_status'"
   ```
7. **Verify query plan** improved (optional but recommended):
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote \
     --command "EXPLAIN QUERY PLAN SELECT * FROM publishing_jobs WHERE provider='telegram' AND status='pending' LIMIT 10"
   ```
   Expected: `USING INDEX idx_pub_jobs_provider_status`.

## i18n Keys

None.

## Test Strategy

No test code change. The migration is verified by:
- Migration script exit 0
- `EXPLAIN QUERY PLAN` shows index used (manual)
- Existing `publishing_jobs` integration tests still pass (regression check)

## Success Criteria

- [ ] Migration applied to remote D1 (1 index created)
- [ ] `sqlite_master` shows `idx_pub_jobs_provider_status` exists
- [ ] `EXPLAIN QUERY PLAN` for telegram filter uses the new index
- [ ] All existing tests pass (no regression)
- [ ] Deploy SHA match (no code change but typically batched with other phases)

## Risk Assessment

- **R1: Index bloat** — One extra index on a moderately-written table. Negligible at current scale.
- **R2: Wrong column order** — `(provider, status)` correct because `provider` is lower cardinality (~5 distinct values) vs `status` (~3-4). SQLite/D1 prefers low-card-leading.
- **R3: Re-apply on next deploy** — `IF NOT EXISTS` handles idempotency; safe.

## Security Considerations

None.

## Verification Steps

```bash
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh

# Verify index exists
npx wrangler d1 execute sophia-raas-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pub_jobs_provider_status'"
# Expected: 1 row returned

# Verify query plan
npx wrangler d1 execute sophia-raas-db --remote \
  --command "EXPLAIN QUERY PLAN SELECT * FROM publishing_jobs WHERE provider='telegram' AND status='pending' LIMIT 10"
# Expected: detail includes 'USING INDEX idx_pub_jobs_provider_status'

# Standard deploy + SHA match
npm run deploy:full
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ SHA match"
```

## Next Steps

- Quick infra win; no follow-up phases blocked.
- Future: monitor query plan if `publishing_jobs` exceeds 100K rows; may need additional partial indexes by tenant.
