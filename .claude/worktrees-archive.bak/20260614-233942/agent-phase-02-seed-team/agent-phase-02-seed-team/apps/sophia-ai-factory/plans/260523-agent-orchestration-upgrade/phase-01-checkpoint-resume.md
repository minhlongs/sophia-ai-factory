---
phase: 1
title: "Checkpoint/Resume Protocol for Agent Tasks"
status: completed
priority: P2
effort: 2h
---

# Phase 01: Checkpoint/Resume Protocol

## Context Links

- Coordinator: `src/tree/sop/multi-agent-coordinator.ts:1-226`
- Helpers: `src/tree/sop/multi-agent-coordinator-helpers.ts:1-77`
- Types: `src/seed/types/multi-agent.ts:1-82`
- Migration: `migrations/0133_multi_agent.sql`
- Existing pattern: `src/tree/gateway/smart-resume-engine.ts` (Supabase-based, reference only)

## Overview

Add checkpoint persistence to agent task assignments so a failed multi-step pipeline can resume from the last successful step instead of restarting the entire session.

## Key Insight

The existing `SmartResumeEngine` uses Supabase for campaign checkpoints. Agent orchestration uses D1 exclusively. We add a `checkpoint_json` column directly to `agent_task_assignments` — no new table needed. This keeps checkpointing co-located with task state, avoiding join overhead.

## Data Flow

```
assignTask() → task created (checkpoint_json = NULL)
  ↓
agent runs step → saveCheckpoint(taskId, stateJSON)
  ↓                  └→ UPDATE agent_task_assignments SET checkpoint_json = ? WHERE id = ?
agent fails midway
  ↓
retry logic calls loadCheckpoint(taskId)
  ↓                  └→ SELECT checkpoint_json FROM agent_task_assignments WHERE id = ?
agent resumes from checkpoint state
```

## Requirements

### Functional
- Save arbitrary JSON checkpoint per task assignment
- Load checkpoint for a given task ID
- Clear checkpoint on task completion (data hygiene)
- Checkpoint survives worker crash (D1 persistent)

### Non-Functional
- Checkpoint size: max 64KB (D1 TEXT column, reasonable for state JSON)
- No performance impact on happy path — checkpoint is a single UPDATE

## Architecture

No new tables. Single column addition to existing table.

## Files to Modify

| File | Change |
|------|--------|
| `src/seed/types/multi-agent.ts` | Add `checkpointJson` field to `AgentTaskAssignment` interface |
| `src/tree/sop/multi-agent-coordinator-helpers.ts` | Map `checkpoint_json` in `rowToTask()` |
| `src/tree/sop/multi-agent-coordinator.ts` | Add `saveCheckpoint()`, `loadCheckpoint()` exports |
| `migrations/0141_agent_task_checkpoints.sql` | `ALTER TABLE agent_task_assignments ADD COLUMN checkpoint_json TEXT` |

## Files to Create

| File | Purpose |
|------|---------|
| `src/tree/sop/__tests__/multi-agent-checkpoint.test.ts` | Unit tests for checkpoint save/load |

## Implementation Steps

### Step 1: Migration

Create `migrations/0141_agent_task_checkpoints.sql`:

```sql
ALTER TABLE agent_task_assignments ADD COLUMN checkpoint_json TEXT;
```

Single column, nullable, no index needed (queried by PK only).

### Step 2: Update Types

In `src/seed/types/multi-agent.ts`, add to `AgentTaskAssignment`:

```typescript
/** JSON-serialized checkpoint state for resume-from-failure */
checkpointJson?: Record<string, unknown>
```

### Step 3: Update Row Mapper

In `src/tree/sop/multi-agent-coordinator-helpers.ts`, add to `rowToTask()`:

```typescript
checkpointJson: row.checkpoint_json
  ? (JSON.parse(row.checkpoint_json as string) as Record<string, unknown>)
  : undefined,
```

### Step 4: Add Coordinator Functions

In `src/tree/sop/multi-agent-coordinator.ts`, add two exports:

```typescript
export async function saveCheckpoint(
  taskId: string,
  checkpoint: Record<string, unknown>
): Promise<void>
```

- Validates `JSON.stringify(checkpoint).length <= 65536` (64KB guard)
- `UPDATE agent_task_assignments SET checkpoint_json = ? WHERE id = ? AND status IN ('pending', 'running')`
- Logs via `logger.info('multi-agent: checkpoint saved', { taskId })`

```typescript
export async function loadCheckpoint(
  taskId: string
): Promise<Record<string, unknown> | null>
```

- `SELECT checkpoint_json FROM agent_task_assignments WHERE id = ?`
- Returns parsed JSON or null

### Step 5: Clear Checkpoint on Completion

In existing `completeTask()`, add `checkpoint_json = NULL` to the UPDATE statement. Failed tasks keep their checkpoint for debugging/retry.

### Step 6: File Size Check

After adding `saveCheckpoint` + `loadCheckpoint`, verify `multi-agent-coordinator.ts` stays under 200 lines. If over, extract checkpoint functions to `multi-agent-coordinator-checkpoint.ts` (same pattern as helpers file).

## Todo List

- [x] Create migration `0141_agent_task_checkpoints.sql`
- [x] Add `checkpointJson` to `AgentTaskAssignment` type
- [x] Update `rowToTask()` mapper
- [x] Implement `saveCheckpoint()` in coordinator
- [x] Implement `loadCheckpoint()` in coordinator
- [x] Add checkpoint clearing to `completeTask()`
- [x] Write tests: save, load, clear-on-complete, 64KB limit rejection
- [ ] Apply migration to remote D1 (`bash scripts/apply-migrations.sh`) — operator step
- [x] Verify build passes (`npm run build`)

## Success Criteria

- `saveCheckpoint(taskId, { step: 3, partialOutput: {...} })` persists to D1
- `loadCheckpoint(taskId)` returns the saved state
- `completeTask(taskId, output)` clears the checkpoint
- Checkpoint > 64KB throws descriptive error
- All new tests pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ALTER TABLE ADD COLUMN` on production D1 with existing rows | Low | Low | SQLite `ALTER TABLE ADD COLUMN` is safe for nullable columns; no rewrite |
| Checkpoint JSON too large | Low | Medium | 64KB guard in `saveCheckpoint()` |
| Coordinator file exceeds 200 lines | Medium | Low | Extract to separate file if needed |

## Security

- Checkpoint data is tenant-scoped (task belongs to session belongs to execution)
- No PII stored in checkpoints — only pipeline state (step index, partial outputs)
- JSON parse errors caught and logged, not thrown to caller

## Next Steps

- Phase 2 (circuit breaker) can consume checkpoints for retry-from-checkpoint pattern
- Fleet spawner can call `loadCheckpoint()` before re-dispatching a failed task
