# Phase 03 — Cron Workflow Stepper

## Context Links
- Existing cron pattern: `apps/sophia-ai-factory/wrangler.toml` L28-42 (10 triggers active)
- Sibling cron: `/api/cron/local-mode-health` (Phase F, shipped 2026-04-17)
- Execute: `apps/sophia-ai-factory/src/app/api/raas/execute/route.ts`
- Repository: `src/lib/workflows/workflow-repository.ts` (from Phase 02)

## Overview
- Priority: P2 (makes workflow actually advance)
- Status: ✅ complete
- Cron `*/1 * * * *` polls `workflows WHERE status IN ('queued','running')`, advances state machine step-by-step, emits events.

## Key Insights
- CF Workers cron = isolated worker invocation, no long-running process
- Must be idempotent: multiple invocations within 1 min must not double-advance
- Idempotency key = `(workflow_id, step_order)` — every UPDATE includes `WHERE status='queued'` gate
- Workflows that sit in `queued` flip to `running` on first tick
- `completed` / `failed` workflows are ignored (WHERE filter)

## Requirements

### Functional
- Trigger: `*/1 * * * *` (every minute)
- Authentication: internal-only — relies on CF Workers cron context (no public POST)
- Per tick:
  1. Fetch up to 20 active workflows (status in queued/running)
  2. For each: advance via single-step state machine (see below)
  3. Emit WORKFLOW_STEP_COMPLETED / WORKFLOW_COMPLETED / WORKFLOW_FAILED as appropriate
- Max execution budget per tick: ≤10s (CF soft limit)

### State Machine (per workflow)
```
wf.status='queued'  → set 'running', set step1 from 'queued' (already), trigger /api/raas/execute internally
wf.status='running' →
    current = missions WHERE parent_mission_id=wf.id AND status='queued' ORDER BY step_order LIMIT 1
    prev    = missions WHERE parent_mission_id=wf.id AND step_order=current-1
    if current exists AND (prev is null OR prev.status='completed'):
        execute current (POST /api/raas/execute with x-internal-secret)
    elif prev.status='failed':
        set wf.status='failed', emit WORKFLOW_FAILED
    elif all missions completed:
        set wf.status='completed', final_result = last mission.result, emit WORKFLOW_COMPLETED
    unblocked_next = missions WHERE status='blocked' AND step_order = last_completed+1
    if unblocked_next: UPDATE ... SET status='queued' WHERE status='blocked'  (atomic)
```

### Non-Functional
- Idempotency: every state transition guarded by `WHERE status=<expected>`
- Crash-safe: if tick dies mid-loop, next tick picks up where left off

## Architecture
```
cron(*/1)
   ├─ handler: /api/cron/workflow-stepper GET
   ├─ SELECT active workflows (LIMIT 20)
   └─ per workflow: advanceOne(wf)
         ├─ read step missions (3 rows)
         ├─ determine next transition
         ├─ UPDATE guarded by prior state
         ├─ POST /api/raas/execute (if new step queued)
         └─ trackD1Event(WORKFLOW_*)
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/app/api/cron/workflow-stepper/route.ts` (~180 LOC — GET handler + advanceOne)
- `apps/sophia-ai-factory/src/lib/workflows/supervisor-state-machine.ts` (~140 LOC — pure `advanceOne(db, workflow, stepMissions) → Transition[]` fn)

### Modify
- `apps/sophia-ai-factory/wrangler.toml` — append `"*/1 * * * *"` to `crons` array + comment

### Delete
- none

## Implementation Steps

1. **Create `supervisor-state-machine.ts`** — stateless pure function:
   ```ts
   export type Transition =
     | { kind: 'start_workflow';  workflow_id: string }
     | { kind: 'execute_step';    mission_id: string; step_order: number; step_type: string }
     | { kind: 'unblock_next';    mission_id: string; step_order: number }
     | { kind: 'complete_workflow'; workflow_id: string; final_result: string }
     | { kind: 'fail_workflow';   workflow_id: string; error: string };

   export function computeNext(wf: Workflow, steps: Mission[]): Transition[] { ... }
   ```
   - Deterministic; easy to unit-test (no I/O)

2. **Create `workflow-stepper/route.ts`**:
   - Export `GET` (CF cron invokes GET)
   - Reject if `x-cron-secret` or `cf-cron-trigger` not present (prevent public abuse)
   - Loop: fetch active workflows → for each: read step missions → compute transitions → apply via repository → emit events
   - Try/catch per workflow (one bad workflow doesn't kill tick)

3. **Modify `wrangler.toml`**:
   ```toml
   crons = [..., "*/1 * * * *"]
   # "*/1 * * * *" — every 1 min → /api/cron/workflow-stepper (supervisor agent stepper)
   ```

4. **Add `handleCron` route switch** (if project has central cron dispatcher — verify with Grep; else CF auto-routes by URL)

5. **Compile check**: `npm run build`

## Todo List
- [ ] Create supervisor-state-machine.ts (pure fn)
- [ ] Create workflow-stepper/route.ts (GET handler)
- [ ] Update wrangler.toml `crons` + comment block
- [ ] Compile + unit-test state machine
- [ ] Commit `feat(cron): supervisor workflow stepper (1-min tick)`

## Success Criteria
- After Phase 01+02 live: create workflow → wait ≤3 min → D1: workflow.status='completed', all 3 missions completed
- Idempotency: run stepper 5× manually within 10s → step never executes twice (check mission.started_at)
- Fail-fast: if step 2 status='failed' → workflow transitions to 'failed' within 1 tick, step 3 remains 'blocked'
- State machine unit tests: ≥6 scenarios (start, advance, complete, fail-mid, already-done, blocked-step)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Double-advance on concurrent ticks | HIGH | WHERE status=<expected> gate on every UPDATE |
| Long tick exceeds 10s | MED | LIMIT 20 workflows/tick + early return |
| `/api/raas/execute` secret mismatch | HIGH | Reuse existing `INTERNAL_API_SECRET` env var |
| 1-min cron unavailable on CF free plan | MED | Fallback to `*/5 * * * *` if billing rejects |
| Poison workflow loops tick | MED | Emit WORKFLOW_FAILED after 10 consecutive ticks with no progress (followup — track `updated_at`) |

## Security Considerations
- Cron endpoint MUST reject unauthenticated public requests → check `request.headers.get('cf-cron-trigger')` OR require `x-internal-secret`
- No user data in event payloads beyond workflow_id + step_type

## Integration Test Commands
```bash
cd apps/sophia-ai-factory
npm run build
npm test -- supervisor-state-machine

# Local dry-run against miniflare:
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*/1+*+*+*+*"

# Manually tick:
curl -H 'x-internal-secret: <SECRET>' http://localhost:8787/api/cron/workflow-stepper
```

## Ship Stamp (2026-04-17)
- **Files:** supervisor-state-machine.ts (140 LOC, pure Transition logic), workflow-stepper/route.ts (180 LOC, cron handler), wrangler.toml (cron trigger appended)
- **Status:** ✅ Shipped
- **Tests:** 18 new tests (state machine 6 scenarios, stepper idempotency, concurrent tick safety)
- **Code review:** 4 highs (idempotency gates, crash-safety, event dedup keys) fixed → approved
- **Quality:** WHERE status guards on all UPDATEs, INTERNAL_API_SECRET validation, per-workflow error isolation

## Next Steps
- Unblocks Phase 05 (integration test runs the full chain) ✅ DONE
- Independent of Phase 04 (UI can be built in parallel) ✅ DONE
