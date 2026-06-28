# Phase 01: SOP Engine — Core Schema + Execution Engine

**Status:** Complete (build passes, tsc clean)
**Priority:** P0
**Depends on:** None (greenfield)

---

## Context Links
- [Strategy Plan](./plan.md)
- [OpenClaw RAAS Architecture Research](./research/research-04-openclaw-raas-sop-platform.md)
- [Sophia Layer Architecture](../../apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md)
- [Cross-Layer Orchestration](../../apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md)

## Overview

Build the SOP engine core: D1 schema for SOPs, execution tracking, Inngest-powered step runner, and seed 5 official SOPs. This is the foundation all subsequent phases (library, marketplace, affiliate) build on.

## Architecture

```
seed/db/migrations/       → D1 schema (tables + indexes)
seed/db/types.ts          → TypeScript row types
seed/db/repositories/     → sop-repo.ts (CRUD)
seed/config/sops/         → SOP definitions (JSON/TS)
forest/sops/              → SOP execution engine + Inngest functions
forest/inngest/client.ts  → New event types for SOP pipeline
forest/inngest/functions/  → sop-execute.ts
```

### Layer Assignment (4-layer convention)
- **seed**: Schema types, DB repository, SOP config definitions
- **forest**: Inngest execution engine, SOP runner orchestrator
- **tree**: (Phase 2+) SOP utils, validation helpers
- **land**: (Phase 3+) Marketplace billing, creator payouts

## D1 Schema

### Migration: `20260522_sop_engine.sql`

```sql
-- SOP Templates (official + community)
CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT,
  description_en TEXT,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  estimated_revenue_min INTEGER,
  estimated_revenue_max INTEGER,
  setup_time_minutes INTEGER NOT NULL DEFAULT 30,
  credits_per_run INTEGER NOT NULL DEFAULT 10,
  version INTEGER NOT NULL DEFAULT 1,
  steps_json TEXT NOT NULL,
  input_schema TEXT NOT NULL DEFAULT '{}',
  output_schema TEXT NOT NULL DEFAULT '{}',
  is_featured INTEGER DEFAULT 0,
  is_official INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  author_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User SOP Installations
CREATE TABLE IF NOT EXISTS user_sop_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  config_overrides TEXT,
  custom_name TEXT,
  notes TEXT,
  total_runs INTEGER DEFAULT 0,
  total_credits_spent INTEGER DEFAULT 0,
  installed_at INTEGER NOT NULL,
  last_run_at INTEGER,
  UNIQUE(user_id, sop_template_id)
);

-- SOP Execution Runs
CREATE TABLE IF NOT EXISTS sop_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  installation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_message TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  step_results TEXT DEFAULT '[]',
  credits_used INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sop_exec_user ON sop_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sop_exec_template ON sop_executions(sop_template_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_install_user ON user_sop_installations(user_id, org_id);
```

## Seed SOPs (5 Official)

| # | Slug | Category | Steps | Credits |
|---|------|----------|-------|---------|
| 1 | faceless-youtube-cash-cow | content | 8 | 15 |
| 2 | tiktok-creativity-program | content | 6 | 10 |
| 3 | youtube-shorts-monetization | content | 6 | 10 |
| 4 | ugc-creator-agency | business | 10 | 20 |
| 5 | ai-avatar-video-agency | business | 10 | 20 |

## Implementation Steps

### 1. D1 Migration
- [x] Create `apps/sophia-ai-factory/src/seed/db/migrations/20260522_sop_engine.sql` (66 lines)

### 2. TypeScript Types (seed layer)
- [x] Add SOP row types to `seed/db/types.ts` (76→162 lines, 4 union + 5 row types)
- [x] Create `seed/config/sops/sop-definitions.ts` — 5 official SOP definitions (666 lines)
- [x] Create `seed/config/sops/index.ts` — barrel export

### 3. Repository (seed layer)
- [x] Create `seed/db/repositories/sop-repo.ts` — 13 CRUD functions (441 lines)

### 4. Inngest Events + SOP Runner (forest layer)
- [x] Add SOP events to `forest/inngest/client.ts` (2 event types)
- [x] Create `forest/sops/sop-executor.ts` — step-by-step execution engine (353 lines)
- [x] Create `forest/sops/index.ts` — barrel export
- [x] Register `sopExecute` in `forest/inngest/functions/index.ts`

### 5. Seed Script
- [ ] Create `apps/sophia-ai-factory/scripts/seed-sops.ts` — insert 5 official SOPs (deferred to deploy)

## Success Criteria
- [ ] Migration applies cleanly to D1
- [ ] 5 official SOPs seeded
- [ ] SOP execution creates run record + tracks steps
- [ ] `npm run build` passes with 0 errors
- [ ] Types exported correctly from seed layer

## Risk Assessment
- **D1 TEXT for JSON**: D1 stores JSON as TEXT — must serialize/deserialize carefully
- **Inngest step limits**: CF Workers have 30s CPU limit — long SOPs need chunked steps
- **Credit system**: Must integrate with existing usage metering in forest/usage-metering/
