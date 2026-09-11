# MISSION INTEGRITY & PREFLIGHT FORENSIC AUDIT — Sophia AI Factory

**Audit Lane:** Lane C (Phases 5 & 6)  
**Target Codebase:** `apps/sophia-ai-factory/src/`  
**Auditor:** Senior SRE / Forensic Security Auditor  
**Audit Date:** 2026-09-11  
**Status:** COMPLETED — ADVERSARIAL EVIDENCE BACKED  

---

## Executive Summary

A forensic code-level audit was conducted across the mission execution engine, state machines, preflight gates, cost/quota enforcement, and artifact tracking in Sophia AI Factory (`apps/sophia-ai-factory`).

### Key Findings
1. **Critical Architectural Triplication (P1):** Three disconnected generations of mission engines coexist simultaneously:
   - `missions` (legacy RaaS campaign table, `0001-init.sql`)
   - `engine_missions` (command/tool execution table, `0052-missions-engine.sql`, driven by `auto-video-mission.ts` and `dispatcher.ts`)
   - `creative_missions` + `agent_runs` (Sophia 2027 Agent Protocol state machine, `0233_missions.sql` and `0240_agent_runs.sql`, driven by `agent-mission-executor.ts`)
2. **Preflight Checker Universal Bypass (P0):**
   - The canonical 7-gate preflight checker (`src/forest/mission/preflight-check.ts`) is called in **exactly ONE place** in the entire codebase: `src/land/creative-mission/actions.ts:446`.
   - In `actions.ts:441`, the parameter `skipPreflight: z.boolean().optional()` allows arbitrary callers to bypass `runMissionPreflightCheck` entirely.
   - All other generation entrypoints (`auto-video-mission.ts`, `image-generate-action.ts`, `/api/missions/auto-video`, `dispatcher.ts`) **completely bypass** the 7-gate checker.
3. **Double-Charge / Duplicate External Billable Execution on Retry (P0):**
   - In `src/forest/inngest/functions/agent-mission-executor.ts`, the entire execution runs as a monolithic function without `step.run()` checkpoints.
   - If `executeAgent()` successfully invokes paid external BYOK APIs (e.g. OpenRouter, ElevenLabs, D-ID, fal.ai) but a subsequent database operation fails (e.g. `advanceMissionToReview`, D1 timeout, network glitch), the catch block marks the run as `status = 'failed'`.
   - `agent-rollback-cron.ts` scans for `status = 'failed'` runs and automatically re-dispatches `agent.mission.started`, triggering a **second paid external API invocation** with zero deduplication or intermediate checkpoint recovery.
4. **Currency & Unit Fragmentation / Free Execution Hole (P0):**
   - Preflight Gate 3 verifies `mcuBalance > 0` or tier `MASTER`.
   - However, `creative_missions` execution **never deducts MCU credits**. Spend is tracked only as `spent_cents` in USD cents on the `creative_missions` row. A user with 1 MCU can execute an infinite number of creative agent missions without their MCU balance ever decrementing.
   - Units are fragmented across three incompatible schemes: Integer MCU (`user_mcu_balance`), Integer Cents (`creative_missions.spent_cents`, `agent_runs.total_cost_cents`), and Float USD (`video_cost_log.cost_usd`).

---

## Phase 5: Mission Execution Forensics

### 5.1 Three Coexisting Mission Schemas (Architecture Triplication)

| Table | Migration | Engine Handler | Storage / Artifacts | Status Authority |
|---|---|---|---|---|
| `missions` | `0001-init.sql` | Legacy campaign flow | `campaign_assets` | `draft`, `queued`, `processing`, `completed`, `failed` |
| `engine_missions` | `0052-missions-engine.sql` | `src/land/missions/auto-video-mission.ts`<br>`src/forest/missions/dispatcher.ts` | `engine_checkpoints`<br>`video_jobs` | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `creative_missions`<br>`agent_runs` | `0233_missions.sql`<br>`0240_agent_runs.sql` | `src/forest/inngest/functions/agent-mission-executor.ts` | `creative_memory`<br>`sop_artifacts`<br>`sop_executions` | `draft`, `planned`, `approval_required`, `running`, `paused`, `review`, `completed`, `learning`, `iterating` |

#### Architectural Risk
The UI and API expose multiple routes that create different mission rows in different tables. A customer inspecting their dashboard may see divergent state because `/dashboard/missions` queries `creative_missions`, while automated video creation routes (`/api/missions/auto-video`) write to `engine_missions`. There is no foreign key or reconciliation bridge between `engine_missions` and `creative_missions`.

---

### 5.2 State Machine Forensics & Concurrency

#### Creative Mission State Machine (`src/tree/mission/types.ts`)
```typescript
const NEXT_STATUS: Record<CreativeMissionStatus, CreativeMissionStatus[]> = {
  draft: ['planned'],
  planned: ['approval_required'],
  approval_required: ['running'],
  running: ['paused', 'review', 'completed'],
  paused: ['running', 'review'],
  review: ['completed', 'iterating'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running'],
};
```

#### Concurrency & Terminal State Integrity
1. **Optimistic Locking:** `beginMissionExecution` in `src/tree/mission/types.ts:84-106` uses atomic SQL updates:
   ```sql
   UPDATE creative_missions 
   SET status = 'running', current_phase = 'executing', updated_at = ? 
   WHERE id = ? AND status = ?
   ```
   If `meta.changes === 0`, it throws `CONCURRENT_MODIFICATION`. This correctly prevents concurrent duplicate transitions into `running`.
2. **Missing Failure State in `NEXT_STATUS`:**
   Notice that `CreativeMissionStatus` has **no `failed` status**:
   ```typescript
   export type CreativeMissionStatus =
     | 'draft'
     | 'planned'
     | 'approval_required'
     | 'running'
     | 'paused'
     | 'review'
     | 'completed'
     | 'learning'
     | 'iterating';
   ```
   When an execution fails, `creative_missions` cannot transition to `failed`. Instead, `agent_runs.status` is marked `'failed'`, while `creative_missions.status` remains stuck in `'running'` or `'approval_required'`. This causes UI state divergence where a mission shows "Running" indefinitely even though the underlying run has permanently aborted.

---

### 5.3 Double-Execution & Double-Charge Vulnerability (Proof of Exploit)

#### Vulnerability Location:
- `src/forest/inngest/functions/agent-mission-executor.ts:148-266`
- `src/forest/inngest/functions/agent-rollback-cron.ts:168-198`

#### Evidence Chain:
1. `agent-mission-executor.ts` is configured with `retries: 0`:
   ```typescript
   export const agentMissionExecutor = inngest.createFunction(
     { id: 'agent-mission-executor', retries: 0 },
     { event: 'agent.mission.started' },
     async ({ event, step }) => { ... }
   );
   ```
2. The function **does not use `step.run()`** for sub-operations. All operations execute sequentially in a single Node.js async scope.
3. At lines 150-155, `executeAgent()` executes third-party AI provider calls (OpenRouter LLM generation, image generation, voice synthesis) which incurs real monetary cost or consumes customer BYOK quota.
4. If `executeAgent()` succeeds, the executor executes post-processing steps:
   - Line 169: `updateAgentRun(runId, patch)`
   - Line 172: `recordSpend(missionId, result.costCents)`
   - Line 175: `persistAgentLearning(...)`
   - Line 181: `recordPerformanceEvent(...)`
   - Line 186: `emitMissionCompleted(...)`
   - Line 193: `advanceMissionToReview(missionId)`
5. If **any** of lines 169–193 throws (e.g. transient Cloudflare D1 timeout, SQLite lock contention, Inngest event emission network glitch):
   - Execution jumps to `catch (err)` at line 254:
   ```typescript
   catch (err) {
     const message = err instanceof Error ? err.message : String(err);
     logger.error('agentMissionExecutor: exception', { runId, error: message });
     await markRunFailed(runId, message, { code: 'RUNTIME_ERROR', message });
     ...
     throw err;
   }
   ```
   - `agent_runs.status` is set to `'failed'`.
6. At `src/forest/inngest/functions/agent-rollback-cron.ts:168-198`:
   - `agentRollbackCron` runs periodically on cron schedule.
   - It queries `SELECT * FROM agent_runs WHERE status = 'failed' AND retry_count < max_retries`.
   - `redispatchRun()` flips `agent_runs.status` back to `'running'` and re-emits `agent.mission.started`.
7. `agentMissionExecutor` receives the event again. Because there are no checkpoints or idempotency checks on `executeAgent`, **it calls the paid external AI APIs again from scratch**, resulting in double-spending and duplicate provider charges.

---

### 5.4 Orphaned Artifacts & Rollback Failure Paths

In `src/forest/missions/dispatcher.ts`:
- Checkpoints are saved to `engine_checkpoints` via `saveCp()`.
- If an engine mission fails midway through asset generation, generated assets stored in R2 (such as audio clips from ElevenLabs or video fragments) are not tracked in a rollback transaction.
- When `rollbackTo(lastGoodCp)` is invoked, it rewinds the database state pointer, but previously generated R2 objects remain orphaned in storage, incurring continuous storage costs with zero database references.

---

## Phase 6: Pre-flight, Cost & Quota Forensics

### 6.1 The 7-Gate Preflight Checklist (`src/forest/mission/preflight-check.ts`)

`runMissionPreflightCheck` implements a 7-gate fail-closed sequence:
1. **Auth Gate:** Checks `getCurrentUser()` or `opts.userId`. Returns `NOT_AUTHENTICATED` if missing.
2. **Ownership Gate:** Checks `org_members` or `workspaceId === resolvedUserId`. Returns `WORKSPACE_ACCESS_DENIED` if not a member.
3. **Entitlement Gate:**
   - Single-mission spike limit: fails if `estimatedCostCents > MAX_SINGLE_MISSION_COST_CENTS` (500¢ / $5.00).
   - Quota check: checks `tier === 'MASTER'` OR `mcuBalance > 0`. Fails with `INSUFFICIENT_ENTITLEMENT` if 0 MCU.
4. **Credential Gate:** Checks BYOK keys in `user_api_keys`. Fails with `NO_BYOK_CREDENTIALS` or `MISSING_PROVIDER_CREDENTIAL`.
5. **Capability Gate:** Matches configured providers against required capability (`AI_IMAGE`, `AI_VIDEO`, etc.). Fails with `CAPABILITY_NOT_SUPPORTED`.
6. **Storage Gate:** Checks Cloudflare R2 bucket availability (`BACKUPS_BUCKET` / `STORAGE_BUCKET`). Fails with `STORAGE_UNAVAILABLE`.
7. **Queue Gate:** Checks Inngest client operational readiness. Fails with `QUEUE_UNAVAILABLE`.

---

### 6.2 Preflight Bypass Analysis (P0 Proof)

#### Vulnerability 1: Client-Controlled Bypass Parameter
In `src/land/creative-mission/actions.ts:440-461`:
```typescript
const StartMissionSchema = z.object({
  missionId: z.string().min(1),
  estimatedCostCents: z.number().int().nonnegative().optional(),
  skipPreflight: z.boolean().optional(), // <--- ATTACK VECTOR
});

export async function startMissionAction(input: unknown) {
  ...
  const shouldRunPreflight =
    parsed.data.skipPreflight === false ||
    (process.env.NODE_ENV !== 'test' && !parsed.data.skipPreflight);

  if (shouldRunPreflight) {
    const preflight = await runMissionPreflightCheck({ ... });
    if (!preflight.passed) {
      return failure({ code: preflight.failureCode, message: preflight.failureReason });
    }
  }
}
```
**Exploit:** Any authenticated user calling `startMissionAction({ missionId: "...", skipPreflight: true })` causes `!parsed.data.skipPreflight` to evaluate to `false`, completely skipping `runMissionPreflightCheck`. The user can start missions with 0 MCU balance, invalid BYOK keys, or mismatched capabilities.

#### Vulnerability 2: Unwired Routes & Direct Execution Bypass
Forensic grep across the entire codebase confirms that `runMissionPreflightCheck` is imported and called in **only 1 file**:
- `src/land/creative-mission/actions.ts`

The following billable execution entrypoints **never call preflight check**:
1. `POST /api/missions/auto-video` (`src/app/api/missions/auto-video/route.ts`):
   - Calls `runAutoVideoMission()` directly.
   - Checks `checkMissionQuota` (monthly count limit) and `listUserApiKeyProviders`, but skips storage, queue, single-mission cost cap, and capability verification.
2. `image-generate-action.ts` (`src/app/actions/image-generate-action.ts`):
   - Generates images using Fal.ai / Replicate directly. Skips preflight entirely.
3. `dispatcher.ts` (`src/forest/missions/dispatcher.ts`):
   - Dispatches step workflows directly without preflight.

---

### 6.3 Currency & Unit Fragmentation / Billing Gap

#### Three Mismatched Financial Units
1. **Model Compute Units (MCU):**
   - Managed in `src/tree/mcu/credits-repo.ts`.
   - Stored as integer in table `user_mcu_balance`.
   - Deducted atomically via `UPDATE user_mcu_balance SET credits_remaining = credits_remaining - ? WHERE user_id = ? AND credits_remaining >= ?`.
2. **USD Cents:**
   - Stored in `creative_missions.budget_cents`, `creative_missions.spent_cents`, and `agent_runs.total_cost_cents`.
3. **USD Dollars (Float):**
   - Stored in `video_cost_log.cost_usd` and `video_jobs.cost_usd`.

#### The Creative Missions "Free AI" Bug (P0)
- In `src/forest/mission/preflight-check.ts:267-268`:
  The preflight check checks:
  ```typescript
  const hasQuota = isMaster || (typeof mcuBalance === 'number' && mcuBalance > 0);
  ```
- If the user has 1 MCU, preflight passes.
- In `src/forest/inngest/functions/agent-mission-executor.ts:172`:
  ```typescript
  await recordSpend(missionId, result.costCents);
  ```
  `recordSpend()` updates `creative_missions.spent_cents`.
- **CRITICAL OMISSION:** Neither `agentMissionExecutor` nor `recordSpend` ever calls `deductCredits()` from `src/tree/mcu/credits-repo.ts`.
- **Impact:** Creative missions **never consume MCU balance**. The user's MCU balance remains permanently at 1 MCU, allowing infinite agent mission runs without paying for MCU top-ups.

---

### 6.4 Single-Mission Spike Guard ($5.00 Cap)

- Constant: `MAX_SINGLE_MISSION_COST_CENTS = 500` ($5.00 USD).
- Evaluated in `preflight-check.ts:225-243`:
  ```typescript
  if (
    typeof opts.estimatedCostCents === 'number' &&
    opts.estimatedCostCents > 0 &&
    opts.estimatedCostCents > MAX_SINGLE_MISSION_COST_CENTS
  ) {
    return buildPreflightFailure('entitlement', spikeFail, opts);
  }
  ```
- **Flaw:** Because `estimatedCostCents` is provided by the client in `startMissionAction(input)` and defaults to `undefined`, a malicious client can simply omit `estimatedCostCents` to bypass the spike guard.

---

## Actionable Remediation Plan

| Priority | Component | Issue | Required Remediation |
|---|---|---|---|
| **P0** | `src/land/creative-mission/actions.ts` | `skipPreflight` client parameter allows bypass | Remove `skipPreflight` from `StartMissionSchema`. Preflight must be mandatory in all non-test environments. |
| **P0** | `src/forest/inngest/functions/agent-mission-executor.ts` | Monolithic execution causes double-billing on retry | Refactor `agentMissionExecutor` to wrap `executeAgent` in `step.run('execute-agent')`. If post-processing fails, retry resumes from checkpoint without re-invoking AI providers. |
| **P0** | `src/forest/inngest/functions/agent-mission-executor.ts` | Creative missions never deduct MCU balance | Convert `result.costCents` to MCU credits (via `TOPUP_PRICE_PER_MCU`) and atomically call `deductCredits()` in `credits-repo.ts`. |
| **P1** | `src/tree/mission/types.ts` | Missing `failed` status in `CreativeMissionStatus` | Add `failed` to `CreativeMissionStatus` and `NEXT_STATUS`. Update mission to `failed` when `agent_runs` fails. |
| **P1** | `src/app/api/missions/auto-video/route.ts` | Direct execution bypasses 7-gate preflight | Call `runMissionPreflightCheck()` inside `POST /api/missions/auto-video` before dispatching. |
| **P2** | `src/tree/mission/` & `src/forest/missions/` | Schema triplication (`missions` vs `engine_missions` vs `creative_missions`) | Consolidate onto `creative_missions` + `agent_runs`. Deprecate `engine_missions`. |

---

## Unresolved Questions
1. Was `skipPreflight` introduced intentionally as an undocumented debug flag for E2E testing, or did it escape into production code?
2. Should creative missions consume MCU credits directly, or was the platform intended to transition completely from MCU to direct USD cent accounting?
