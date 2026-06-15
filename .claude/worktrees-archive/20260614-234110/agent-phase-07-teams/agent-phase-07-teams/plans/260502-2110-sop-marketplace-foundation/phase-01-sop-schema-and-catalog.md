# Phase 01 — SOP Schema + Catalog Seed

## Context Links

- Plan: [./plan.md](./plan.md)
- Research: `plans/reports/research-260502-2110-3-critical-questions.md` (Q3 — 3-Tier HDR format)
- Existing migrations: `apps/sophia-ai-factory/migrations/0052-missions-engine.sql`, `0053-mcu-credits.sql`, `0054-proposals.sql`
- Existing repo pattern: `apps/sophia-ai-factory/src/lib/missions/command-registry.ts`

## Overview

- Priority: P1
- Status: pending
- Effort: 12h
- Description: D1 schema for SOP templates + user installations + run history. Seed 5 official starter playbooks with 3-tier HDR format (agents.yaml + playbook.md + output.schema.json). Repository module for type-safe access.

## Key Insights

- 3-Tier HDR persisted as 3 TEXT columns (agents_yaml, playbook_md, output_schema) — no separate file storage.
- D1 = SQLite — no JSON column type; store JSON as TEXT, parse at access time.
- `sop_templates.is_official` flag separates Sophia-shipped from future customer-published.
- `user_sop_installations` decouples template from instance — customers can install once, customize copy.
- All starter playbooks reference EXISTING mission commands only (proposal, lead, email, video, analytics, youtube).

## Requirements

### Functional
- F1: 3 tables — `sop_templates`, `user_sop_installations`, `sop_runs`.
- F2: Seed 5 official SOPs at migration time (idempotent INSERT OR IGNORE).
- F3: Repository module exposes typed read/write for templates, installations, runs.
- F4: Slug-based template lookup (URL-friendly: `/marketplace/daily-content-factory`).
- F5: Indexes on hot paths — `user_id`, `enabled+next_run_at`, `installation_id`.

### Non-Functional
- Zero `:any`, all rows typed via TypeScript interfaces.
- Migrations apply local AND remote D1.
- Files ≤200 LOC.
- No prod DB wipe — pure additive.

## Architecture

```
sop_templates (catalog) ──┐
                           ├──< user_sop_installations (per-user copy)
                           │         ├──< sop_runs (history)
                           │         │
seed @ migration ──────────┘         └─ next_run_at advanced by executor
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/migrations/0055-sop-catalog.sql`
- `apps/sophia-ai-factory/migrations/0056-sop-installations.sql`
- `apps/sophia-ai-factory/migrations/0057-sop-runs.sql`
- `apps/sophia-ai-factory/migrations/0058-sop-seed-official.sql`
- `apps/sophia-ai-factory/src/lib/sop/sop-types.ts` — TS interfaces matching DB rows
- `apps/sophia-ai-factory/src/lib/sop/sop-repo.ts` — query functions
- `apps/sophia-ai-factory/src/lib/sop/seeds/daily-content-factory.ts` — exports {agentsYaml, playbookMd, outputSchema}
- `apps/sophia-ai-factory/src/lib/sop/seeds/reactive-lead-engine.ts`
- `apps/sophia-ai-factory/src/lib/sop/seeds/weekly-performance-report.ts`
- `apps/sophia-ai-factory/src/lib/sop/seeds/proposal-auto-pilot.ts`
- `apps/sophia-ai-factory/src/lib/sop/seeds/crisis-pr-mode.ts`
- `apps/sophia-ai-factory/src/lib/sop/seeds/index.ts` — array of 5 seed entries
- `apps/sophia-ai-factory/scripts/generate-sop-seed-sql.mjs` — node script that builds 0058 SQL from TS seeds (avoids hand-escaping multi-line YAML/MD in SQL)
- `apps/sophia-ai-factory/src/lib/sop/sop-repo.test.ts`

### Modify
- `apps/sophia-ai-factory/package.json` — add `js-yaml` runtime dep + `@types/js-yaml` dev dep + script `db:gen-sop-seed`.

## Implementation Steps

1. Write `0055-sop-catalog.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS sop_templates (
     id TEXT PRIMARY KEY,
     slug TEXT UNIQUE NOT NULL,
     name_vi TEXT NOT NULL,
     name_en TEXT NOT NULL,
     description_vi TEXT NOT NULL,
     description_en TEXT NOT NULL,
     category TEXT NOT NULL CHECK (category IN ('content','leads','email','analytics','proposals','crisis')),
     agents_yaml TEXT NOT NULL,
     playbook_md TEXT NOT NULL,
     output_schema TEXT NOT NULL,
     credits_per_run INTEGER NOT NULL DEFAULT 1,
     version INTEGER NOT NULL DEFAULT 1,
     is_official INTEGER NOT NULL DEFAULT 0,
     author_user_id TEXT,
     status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_sop_templates_official ON sop_templates(is_official, status);
   CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
   ```
2. Write `0056-sop-installations.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS user_sop_installations (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     template_id TEXT NOT NULL,
     customizations TEXT,            -- JSON: { playbook_md_override?, agents_yaml_override?, vars? }
     schedule_cron TEXT,             -- nullable for webhook-only SOPs
     enabled INTEGER NOT NULL DEFAULT 1,
     last_run_at INTEGER,
     next_run_at INTEGER,
     run_count INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (template_id) REFERENCES sop_templates(id)
   );
   CREATE INDEX IF NOT EXISTS idx_sop_inst_user ON user_sop_installations(user_id);
   CREATE INDEX IF NOT EXISTS idx_sop_inst_due ON user_sop_installations(enabled, next_run_at);
   ```
3. Write `0057-sop-runs.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS sop_runs (
     id TEXT PRIMARY KEY,
     installation_id TEXT NOT NULL,
     trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron','webhook','manual')),
     mission_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array
     status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','partial')),
     result_summary TEXT,
     error_message TEXT,
     started_at INTEGER,
     completed_at INTEGER,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (installation_id) REFERENCES user_sop_installations(id)
   );
   CREATE INDEX IF NOT EXISTS idx_sop_runs_inst ON sop_runs(installation_id, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_sop_runs_status ON sop_runs(status, started_at);
   ```
4. Build seed TS modules. Each exports `{slug, nameVi, nameEn, descVi, descEn, category, creditsPerRun, agentsYaml, playbookMd, outputSchema}`. Examples:
   - **daily-content-factory** (category=content, credits=10): agents = ContentPlanner + VideoGen + EmailDigest. Playbook steps: `video:create x3`, `email:campaign`. Output schema = `{videos: VideoRef[3], emailId: string}`.
   - **reactive-lead-engine** (leads, credits=2 per webhook): agents = LeadEnricher + EmailWriter. Playbook: `lead:enrich` → `email:test` (personalized) → `email:campaign send-one`. Schema = `{leadId, enriched, emailId}`.
   - **weekly-performance-report** (analytics, credits=1): `analytics:report` → `email:campaign`. Schema = `{reportId, emailId, metricsSnapshot}`.
   - **proposal-auto-pilot** (proposals, credits=5): `lead:find` (5) → `proposal:create x5` → `email:campaign send-each`. Schema = `{proposals: ProposalRef[5]}`.
   - **crisis-pr-mode** (crisis, credits=3, manual gate): `analytics:report mentions` → `proposal:create draft-response`. Schema includes `requiresApproval: true`.
5. Write `scripts/generate-sop-seed-sql.mjs`:
   - Reads seed modules (compile via tsx or pre-compile to JSON).
   - Emits `0058-sop-seed-official.sql` with `INSERT OR IGNORE INTO sop_templates(...) VALUES (...);` for each, escaping single-quotes via `replace(/'/g, "''")`.
   - Use stable IDs (e.g., `sop_official_daily_content_factory`) so re-runs are idempotent.
6. Add `package.json` script `"db:gen-sop-seed": "node scripts/generate-sop-seed-sql.mjs"`. Run once locally → commit generated SQL.
7. Build `sop-types.ts`:
   ```ts
   export interface SopTemplateRow { id: string; slug: string; nameVi: string; /* ... */ agentsYaml: string; playbookMd: string; outputSchema: string; isOfficial: 0|1; /* ... */ }
   export interface SopInstallationRow { id: string; userId: string; templateId: string; customizations: string | null; scheduleCron: string | null; enabled: 0|1; /* ... */ }
   export interface SopRunRow { id: string; installationId: string; triggerType: 'cron'|'webhook'|'manual'; missionIds: string; status: 'queued'|'running'|'succeeded'|'failed'|'partial'; /* ... */ }
   ```
8. Build `sop-repo.ts` exporting:
   - `listOfficialTemplates(db)`, `getTemplateBySlug(db, slug)`, `getTemplateById(db, id)`
   - `listInstallationsForUser(db, userId)`, `getInstallation(db, id)`, `createInstallation(db, input)`, `updateCustomizations(db, id, json)`, `setEnabled(db, id, enabled)`, `advanceSchedule(db, id, lastRunAt, nextRunAt)`, `deleteInstallation(db, id)`
   - `claimDueInstallations(db, now, limit)` — `UPDATE ... SET enabled-pinned WHERE next_run_at <= ? RETURNING ...` pattern (D1 supports RETURNING).
   - `createRun(db, installationId, trigger)`, `updateRunStatus(db, runId, fields)`, `appendMissionId(db, runId, missionId)`.
   - All return typed rows (no `any`).
9. Tests in `sop-repo.test.ts` using `apps/sophia-ai-factory/src/lib/db/test-helpers` (existing pattern in repo): assert seed rows present after migration, assert install→toggle→delete round-trip, assert claimDue returns only enabled+due rows.
10. Run `npx wrangler d1 migrations apply DB --local` then `--remote` (manual step, document in todo).

## Todo List

- [ ] Add `js-yaml` + `@types/js-yaml` to `apps/sophia-ai-factory/package.json`
- [ ] Write migration 0055 (sop_templates)
- [ ] Write migration 0056 (user_sop_installations)
- [ ] Write migration 0057 (sop_runs)
- [ ] Write 5 seed TS modules (daily-content, reactive-lead, weekly-perf, proposal-pilot, crisis-pr)
- [ ] Write seeds/index.ts barrel
- [ ] Write scripts/generate-sop-seed-sql.mjs
- [ ] Run `npm run db:gen-sop-seed` → produces 0058 SQL
- [ ] Write sop-types.ts + sop-repo.ts (≤200 LOC each, split if needed)
- [ ] Write sop-repo.test.ts (≥10 cases incl claimDue)
- [ ] Apply migrations local D1, run tests → green
- [ ] Apply migrations remote D1 (admin step)
- [ ] Verify 5 seed rows present remote via `wrangler d1 execute ... "SELECT slug FROM sop_templates"`

## Success Criteria

- All 4 migrations apply clean local + remote.
- `SELECT count(*) FROM sop_templates WHERE is_official=1` = 5 on both envs.
- `sop-repo.test.ts` passes with ≥10 cases.
- No new `:any` introduced (run `npm run typecheck`).
- Existing 2292 tests still pass.

## Risk Assessment

- R1: Hand-escaping multi-line YAML/Markdown in SQL = error-prone. Mitigation: generator script + INSERT OR IGNORE.
- R2: D1 RETURNING clause support — verified in CF docs but pin behind feature flag if flaky. Mitigation: fallback to SELECT-then-UPDATE if RETURNING fails.
- R3: `js-yaml` bundle size on Workers. Measured ~30KB gz — acceptable. If exceeded, pre-parse seeds at build time.

## Security Considerations

- `sop_templates.author_user_id` nullable, enforces NOT NULL only when `is_official=0` (Phase 3 customer-published; for now always NULL on official rows).
- No user input written to `sop_templates` in this phase — official-only seed.
- `customizations` JSON in `user_sop_installations` — validate against schema in Phase 3 install API before write.

## Next Steps

- Phase 02 consumes `sop-repo.claimDueInstallations` + `createRun`.
- Phase 03 consumes `listOfficialTemplates` + `createInstallation`.
- Phase 04 consumes `updateCustomizations` + `listInstallationsForUser`.

## Open Questions

- Schema column for `is_official` — INTEGER 0/1 (current) or TEXT 'official'/'community'? Sticking with INTEGER for SQLite idiom.
- `crisis-pr-mode` requires human approval before send — model as `requiresApproval` boolean in output schema, executor pauses run? Confirm UX in Phase 04.
