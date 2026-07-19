# SOP Execution System Architecture

## Two Execution Paths (By Design)

### Path 1: `sop_runs` — Dashboard Manual Runs (Phase 1)
- **Table**: `sop_runs` (migration 0057)
- **Runner**: `src/lib/sop/executor/sop-runner.ts`
- **Trigger**: User clicks "Run Now" on dashboard, or cron scheduler
- **Model**: Sequential step execution, fire-and-forget
- **Used by**: All dashboard pages, API routes, run timeline polling
- **Status**: ✅ CANONICAL for CEO dashboard

### Path 2: `sop_executions` — Inngest Graph Executor (Phase 2)
- **Table**: `sop_executions` (migration 0125)
- **Runner**: `src/forest/sops/sop-executor.ts` (Inngest function)
- **Trigger**: `sop/execution.requested` Inngest event
- **Model**: DAG-based parallel wave execution with analytics logging
- **Used by**: Inngest event system, publish-video-action (read-only lookup)
- **Status**: ✅ ADVANCED executor for complex SOPs

## Why Two Systems?
These are **complementary**, not conflicting:
- Phase 1 (`sop_runs`) handles simple SOPs that the CEO needs right now
- Phase 2 (`sop_executions`) handles complex multi-step SOPs with dependency graphs

## Data Flow
```
User → Dashboard "Run Now" → sop-runner.ts → sop_runs table → Timeline UI
User → Inngest Event      → sop-executor.ts → sop_executions table → Analytics
```

## Decision: Keep Both, Document Clearly
No migration needed. Both systems are valid and serve different purposes.
The `publish-video-action.ts` gracefully falls back if `sop_executions` lookup fails.
