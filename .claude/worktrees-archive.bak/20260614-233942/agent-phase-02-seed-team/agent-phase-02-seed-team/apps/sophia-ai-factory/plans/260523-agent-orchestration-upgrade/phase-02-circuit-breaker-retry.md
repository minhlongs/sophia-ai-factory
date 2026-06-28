---
phase: 2
title: "Circuit Breaker + Bounded Retry for Fleet Spawner"
status: complete
priority: P2
effort: 2h
---

# Phase 02: Circuit Breaker + Bounded Retry

## Context Links

- Fleet spawner: `src/lib/openclaw/spawn-agent-fleet.ts:1-164`
- Existing video CB: `src/lib/video/circuit-breaker.ts:1-107` (PROMOTE to seed)
- Existing video CB tests: `src/lib/video/__tests__/circuit-breaker.test.ts`
- Fulfillment CB: `src/lib/fulfillment/circuit-breaker.ts` (will re-import from seed)
- Usage metering CB: `src/forest/usage-metering/realtime-tracker-circuit-breaker.ts`

## Overview

1. **Promote** the circuit breaker from `lib/video/` to `seed/utils/` — it's a domain-agnostic primitive
2. **Add** `withRetry()` exponential backoff utility to `seed/utils/`
3. **Integrate** both into `spawn-agent-fleet.ts` — each task dispatched through `withRetry(withBreaker(fn))`

## Key Insight

The project already has 3 circuit breaker implementations (video, fulfillment, usage-metering). The video one (`lib/video/circuit-breaker.ts`) is the cleanest and most generic. Promoting it to seed eliminates duplication and gives fleet spawner a battle-tested primitive.

## Data Flow

```
spawnAgentFleet(tasks, opts)
  ↓
  for each task:
    withRetry(maxRetries=3, backoff=exponential) {
      withBreaker('agent-fleet') {
        localExecutor(task, tenantId)
      }
    }
  ↓
  if breaker OPEN → fail-fast remaining tasks, return partial results
  if retry exhausted → mark task failed, continue next task
```

## Requirements

### Functional
- Circuit breaker trips after N consecutive failures (configurable, default 5)
- Exponential backoff: base 1s, max 10s, jitter, max 3 retries per task
- When breaker is OPEN, remaining tasks in fleet fail-fast (no pointless retries)
- Fleet returns partial results: successful tasks + failed tasks with error details

### Non-Functional
- No external dependencies (CF Workers bundle size)
- In-memory breaker state (per-isolate, same as existing video CB)
- Retry delay capped at 10s to avoid CF Workers CPU time limits

## Architecture

```
seed/utils/circuit-breaker.ts     ← promoted from lib/video/circuit-breaker.ts
seed/utils/retry-with-backoff.ts  ← new utility
lib/video/circuit-breaker.ts      ← becomes re-export barrel from seed
lib/openclaw/spawn-agent-fleet.ts ← integrates both
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/seed/utils/circuit-breaker.ts` | Promoted circuit breaker (copy from lib/video, same API) |
| `src/seed/utils/retry-with-backoff.ts` | Exponential backoff retry wrapper |
| `src/seed/utils/__tests__/circuit-breaker.test.ts` | Promoted tests |
| `src/seed/utils/__tests__/retry-with-backoff.test.ts` | Retry utility tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/video/circuit-breaker.ts` | Replace with re-export barrel from `@/seed/utils/circuit-breaker` |
| `src/lib/openclaw/spawn-agent-fleet.ts` | Integrate `withBreaker` + `withRetry` into `runTask()` |
| `src/lib/openclaw/__tests__/spawn-agent-fleet.test.ts` | Add tests for retry + circuit breaker behavior |

## Files NOT Modified (avoid scope creep)

- `src/lib/fulfillment/circuit-breaker.ts` — separate fulfillment-specific wrapper; can migrate later
- `src/forest/usage-metering/realtime-tracker-circuit-breaker.ts` — different pattern (KV-backed state)

## Implementation Steps

### Step 1: Promote Circuit Breaker to Seed

Copy `src/lib/video/circuit-breaker.ts` to `src/seed/utils/circuit-breaker.ts`. No changes to API.

Exports to preserve (verified at `lib/video/circuit-breaker.ts:13-107`):
- `type BreakerState`
- `interface BreakerConfig`
- `function getBreakerState(name)`
- `function resetBreaker(name)`
- `async function withBreaker<T>(name, fn, config?)`
- `class BreakerOpenError`

### Step 2: Create Re-export Barrel

Replace `src/lib/video/circuit-breaker.ts` with:

```typescript
/**
 * Re-export from canonical seed location.
 * Kept for backwards compatibility with existing imports.
 */
export {
  type BreakerState,
  type BreakerConfig,
  getBreakerState,
  resetBreaker,
  withBreaker,
  BreakerOpenError,
} from '@/seed/utils/circuit-breaker'
```

This ensures zero breaking changes for existing callers:
- `src/lib/video/composer-ffmpeg.ts` (imports `withBreaker`, `BreakerOpenError` at line ~15)
- `src/app/api/admin/circuit-breaker/reset/route.ts` (imports `resetBreaker`)

### Step 3: Create Retry Utility

Create `src/seed/utils/retry-with-backoff.ts`:

```typescript
export interface RetryConfig {
  maxRetries: number       // default 3
  baseDelayMs: number      // default 1000
  maxDelayMs: number       // default 10000
  jitter: boolean          // default true
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T>
```

Algorithm:
1. Attempt `fn()`
2. On failure, if attempts < maxRetries: wait `min(baseDelay * 2^attempt + jitter, maxDelay)`, retry
3. On final failure: throw last error
4. On `BreakerOpenError`: do NOT retry (circuit is open, retrying is pointless)

### Step 4: Integrate into Fleet Spawner

Modify `runTask()` in `src/lib/openclaw/spawn-agent-fleet.ts`:

```typescript
import { withBreaker, BreakerOpenError } from '@/seed/utils/circuit-breaker'
import { withRetry } from '@/seed/utils/retry-with-backoff'

async function runTask(task: AgentTask, tenantId: string): Promise<AgentResult> {
  const start = Date.now()
  try {
    const enrichedTask: AgentTask = {
      ...task,
      context: { ...task.context, tenantId },
    }
    const output = await withRetry(
      () => withBreaker('agent-fleet', () => localExecutor(enrichedTask, tenantId)),
      { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
    )
    return { taskId: task.id, success: true, output, durationMs: Date.now() - start }
  } catch (err) {
    return {
      taskId: task.id,
      success: false,
      error: err instanceof BreakerOpenError
        ? `Circuit breaker open — upstream degraded`
        : String(err),
      durationMs: Date.now() - start,
    }
  }
}
```

Add `retryCount` to `AgentResult` interface for observability:

```typescript
export interface AgentResult {
  taskId: string
  success: boolean
  output?: unknown
  error?: string
  durationMs: number
  retryCount?: number  // NEW: how many retries were attempted
}
```

### Step 5: Fleet-Level Breaker Check

In `spawnAgentFleet()`, before dispatching each task, check if breaker is already open:

```typescript
import { getBreakerState } from '@/seed/utils/circuit-breaker'

// Inside the loop:
if (getBreakerState('agent-fleet') === 'open') {
  results.push({ taskId: task.id, success: false, error: 'Skipped — circuit breaker open', durationMs: 0 })
  continue
}
```

This prevents pointless dispatch when upstream is known-degraded.

### Step 6: Move Tests

Copy `src/lib/video/__tests__/circuit-breaker.test.ts` to `src/seed/utils/__tests__/circuit-breaker.test.ts`. Update imports to `@/seed/utils/circuit-breaker`.

## Todo List

- [x] Copy circuit breaker to `seed/utils/circuit-breaker.ts`
- [x] Replace `lib/video/circuit-breaker.ts` with re-export barrel
- [x] Verify `lib/video/composer-ffmpeg.ts` imports still compile
- [x] Create `seed/utils/retry-with-backoff.ts`
- [x] Write retry tests: happy path, max retries, BreakerOpenError skip, jitter bounds
- [x] Integrate into `spawn-agent-fleet.ts` `runTask()`
- [x] Add fleet-level breaker check (skip dispatch when open)
- [x] Add `retryCount` to `AgentResult`
- [x] Update fleet spawner tests
- [x] Verify build passes

## Success Criteria

- Circuit breaker trips after 5 consecutive fleet task failures
- Tasks retry up to 3 times with exponential backoff
- `BreakerOpenError` skips retry (no wasted attempts)
- Fleet returns partial results when breaker trips mid-fleet
- All existing `lib/video/circuit-breaker` tests pass from new seed location
- All existing `lib/video/composer-ffmpeg.ts` imports still work

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Re-export barrel breaks existing imports | Low | High | Verify all callers compile; barrel preserves exact export signatures |
| CF Workers CPU time exceeded by retry delays | Low | Medium | Max delay capped at 10s; 3 retries max = worst case 21s total wait |
| In-memory breaker state lost on isolate recycle | Medium | Low | Acceptable — breaker is per-request-context protection, not persistent state |
| Fulfillment CB divergence after seed promotion | Low | Low | Not touching fulfillment CB this phase; can migrate in future |

## Callers of `lib/video/circuit-breaker.ts` (verified by grep)

1. `src/lib/video/composer-ffmpeg.ts` — `withBreaker`, `BreakerOpenError`
2. `src/app/api/admin/circuit-breaker/reset/route.ts` — `resetBreaker`
3. `src/lib/video/__tests__/circuit-breaker.test.ts` — all exports

All 3 will work through re-export barrel. No other callers found.

## Security

- Retry logic respects tenant isolation (tenantId injected per task, unchanged)
- Circuit breaker is per-name, not per-tenant — acceptable for fleet-level protection
- No secrets or PII in breaker state (just counters + timestamps)

## Next Steps

- Future: migrate `lib/fulfillment/circuit-breaker.ts` to import from `seed/utils/`
- Future: migrate `forest/usage-metering/realtime-tracker-circuit-breaker.ts` (different pattern, may not fit)
