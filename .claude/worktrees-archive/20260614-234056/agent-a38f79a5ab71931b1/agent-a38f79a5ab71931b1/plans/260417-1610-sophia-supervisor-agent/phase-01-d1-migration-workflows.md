# Phase 01 — D1 Migration: workflows table

## Context Links
- Existing: `apps/sophia-ai-factory/migrations/0001-init.sql` (missions table L80-98, has `parent_mission_id` unused)
- Last migration: `0006-users-local-mode.sql`
- New: `0007-workflows.sql`

## Overview
- Priority: P2 (blocking)
- Status: ✅ complete
- Add `workflows` table + extend indexes on `missions.parent_mission_id`. Keep missions columns unchanged — encode step metadata in `missions.params` JSON.

## Key Insights
- `parent_mission_id TEXT` already exists at migrations/0001-init.sql:93 → reuse as FK to `workflows.id`
- D1 = SQLite → no concurrent DDL; migration must be idempotent (IF NOT EXISTS)
- No ALTER to missions columns needed → avoid schema churn

## Requirements

### Functional
- New `workflows` table with id, org_id, prompt, status, final_result (TEXT JSON), timestamps
- Status enum (TEXT CHECK): `queued | running | completed | failed`
- Index on (org_id, status) for dashboard list query
- Index on missions(parent_mission_id) for stepper lookup

### Non-Functional
- Migration runs in <100ms on empty D1
- Idempotent (safe to re-run)
- No data migration required (new table only)

## Architecture
```
workflows (new)         missions (existing, reused)
─────────────           ────────────────────────────
id ─────────┐           id
org_id      └──────────◄parent_mission_id
prompt                   params (JSON: {step_order, step_type})
status                   status
final_result (JSON)      result
created_at               ...
updated_at
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/migrations/0007-workflows.sql` (~50 LOC)

### Modify
- none

### Delete
- none

## Implementation Steps

1. Create `0007-workflows.sql` with:
   ```sql
   CREATE TABLE IF NOT EXISTS workflows (
     id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
     org_id TEXT NOT NULL REFERENCES organizations(id),
     prompt TEXT NOT NULL,
     status TEXT DEFAULT 'queued'
       CHECK (status IN ('queued','running','completed','failed')),
     final_result TEXT,
     error_message TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now'))
   );
   CREATE INDEX IF NOT EXISTS idx_workflows_org_status ON workflows(org_id, status);
   CREATE INDEX IF NOT EXISTS idx_missions_parent ON missions(parent_mission_id);
   ```
2. Apply locally: `wrangler d1 execute sophia-db --local --file=migrations/0007-workflows.sql`
3. Verify schema: `wrangler d1 execute sophia-db --local --command="SELECT sql FROM sqlite_master WHERE name='workflows'"`
4. Apply prod (Phase 5 deploy step): `wrangler d1 execute sophia-db --remote --file=migrations/0007-workflows.sql`

## Todo List
- [ ] Write migration SQL file
- [ ] Run locally, confirm table + indexes exist
- [ ] Commit with `feat(db): add workflows table for supervisor agent`

## Success Criteria
- `SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'` returns 1 row (local + prod)
- `EXPLAIN QUERY PLAN SELECT * FROM missions WHERE parent_mission_id=?` uses `idx_missions_parent`
- Re-running migration produces no error

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| FK to organizations fails if org missing | HIGH | Require valid org_id in API layer (Phase 02) |
| D1 migration fails on prod | HIGH | Dry-run on local first; wrangler validates |
| parent_mission_id not indexed → slow stepper | MED | Add index in this migration |

## Security Considerations
- `final_result` may contain user data → treat as sensitive; no PII in events
- `org_id` FK prevents cross-tenant leakage

## Ship Stamp (2026-04-17)
- **File:** `migrations/0007-workflows.sql` (48 LOC)
- **Status:** ✅ Shipped
- **Tests:** Migration verified on local D1 + prod deployment applied
- **Code review:** Approved (no issues)
- **Quality:** Idempotent IF NOT EXISTS clauses, 2 indexes for perf

## Next Steps
- Unblocks Phase 02 (API routes use this schema) ✅ DONE
