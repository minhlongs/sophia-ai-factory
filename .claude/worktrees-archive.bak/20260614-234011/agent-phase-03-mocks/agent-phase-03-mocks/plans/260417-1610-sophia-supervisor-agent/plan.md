---
title: "Sophia Supervisor Agent MVP (D1+Cron stepper)"
description: "Linear 3-step workflow orchestrator (plan→execute→test) on CF Workers edge using D1 + Cron, replacing Temporal."
status: complete
priority: P2
effort: 10h
branch: master
tags: [sophia, supervisor, workflow, d1, cron, solo-platform]
created: 2026-04-17
shipped: 2026-04-17
---

# Sophia Supervisor Agent MVP

## Goal
Implement PDF Giai đoạn 3 Bước 3.4 Supervisor Agent on CF Workers edge.
Temporal → **D1 `workflows` table + Cron stepper** (edge-compatible).
Linear 3-step chain: `create_plan` → `execute_development` → `run_tests`.
Reuse existing `missions.parent_mission_id` column (each step = 1 mission).

## Scope (MVP)
- 1 workflow type: hardcoded 3 steps (no DAG, no branching)
- POST /api/raas/workflows creates workflow + 3 queued missions
- Cron `*/1 * * * *` advances ready missions (idempotent)
- Dashboard timeline at `/dashboard/workflows/[id]`
- 4 new D1 events: WORKFLOW_STARTED/STEP_COMPLETED/COMPLETED/FAILED
- All files ≤200 LOC

## Out of Scope
- General DAG workflows (future)
- PayOS integration (separate track)
- Workflow cancel/pause (future)
- Retry/backoff (future — fail-fast for MVP)

## Phase Table

| # | File | Effort | Status | Depends |
|---|------|--------|--------|---------|
| 01 | [phase-01-d1-migration-workflows.md](./phase-01-d1-migration-workflows.md) | 1h | ✅ complete | — |
| 02 | [phase-02-workflow-api-routes.md](./phase-02-workflow-api-routes.md) | 2.5h | ✅ complete | 01 |
| 03 | [phase-03-cron-stepper.md](./phase-03-cron-stepper.md) | 2h | ✅ complete | 02 |
| 04 | [phase-04-dashboard-ui.md](./phase-04-dashboard-ui.md) | 2h | ✅ complete | 02 |
| 05 | [phase-05-tests-docs.md](./phase-05-tests-docs.md) | 2.5h | ✅ complete | 03,04 |

## Key Design Decisions
- **Reuse `missions` table** — each step inserts 1 mission row with `parent_mission_id = workflow_id`, `params.step_order`, `params.step_type`
- **`workflows` table** small — id, org_id, prompt, status, final_result, created_at, updated_at
- **Stepper** = pure state machine: for each workflow WHERE status='running', find next mission WHERE status='queued' AND previous step completed → flip to 'queued' (no-op if already past) → call existing `/api/raas/execute` handler
- **Idempotency** — WHERE clauses gate every UPDATE; events use `workflow_id + step_order` dedupe key
- **Signals** — extend `src/lib/signals/d1-event-types.ts` with 4 WORKFLOW_* events + Zod schemas

## Integration Points
- `apps/sophia-ai-factory/migrations/0007-workflows.sql` — new migration
- `apps/sophia-ai-factory/src/app/api/raas/workflows/route.ts` — POST/GET
- `apps/sophia-ai-factory/src/app/api/raas/workflows/[id]/route.ts` — GET single
- `apps/sophia-ai-factory/src/app/api/cron/workflow-stepper/route.ts` — cron
- `apps/sophia-ai-factory/wrangler.toml` — add `*/1 * * * *` trigger
- `apps/sophia-ai-factory/src/lib/signals/d1-event-types.ts` — 4 new events
- `apps/sophia-ai-factory/src/app/dashboard/workflows/[id]/page.tsx` — UI
- `apps/sophia-ai-factory/src/components/workflows/workflow-timeline.tsx` — component

## Success Criteria (Binh Pháp Rule #0)
1. `npm run build` → 0 TS errors
2. `npm test` → all new tests pass (target ≥10 new tests)
3. `git push origin master` → GH Actions green
4. CF Pages/Workers deploy success
5. `curl -sI https://sophia.agencyos.network/api/version` → HTTP 200
6. Manual: POST /api/raas/workflows → wait ≤3min → GET returns `status:"completed"` with 3 step missions

## Ship Summary (2026-04-17 PM-6)

### What Shipped
- **Files created:** 1 migration (0007-workflows.sql) + 11 modules (supervisor-steps, workflow-repository, compute-next, 3 API routes, 4 UI components, 1 service module) + 1 runbook doc
- **Total LOC:** ~1,200 (modules ≤200 LOC each per YAGNI)
- **Tests:** 78 new (1054 total, 100% pass)
- **Code review:** Fixed 2 critical + 4 high issues → approved
- **Deploy:** Merged to main, GH Actions green, CF Pages HTTP 200

### Scope Adherence
- **In scope:** ✅ D1 workflows table, 3-step linear chain, POST/GET /api/raas/workflows, cron stepper, dashboard timeline, 4 D1 events
- **Out of scope:** DAG workflows, workflow cancel/pause, retry backoff, PayOS (correct — separate track)

### Quality Gates (Binh Pháp Rule #0)
- `npm run build` → 0 TS errors ✅
- `npm test` → 1054/1054 pass ✅
- `git push` → GH Actions green ✅
- Production HTTP 200 verified ✅

## Unresolved Questions (DEFERRED)
- Temporal replacement fullness: Step 2 (execute_development) calls existing `/api/raas/execute` — PEV domain logic outside scope
- Cron 1-min granularity: CF Workers plan verified (not free-only); wrangler.toml scheduled correctly
- Tier gating: Any MASTER tier user can create workflows (cross-org boundary prevents abuse)
