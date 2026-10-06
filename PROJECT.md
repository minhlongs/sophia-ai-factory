# Project: Autonomous AGI Loop Control (`mk-autonomous` / CHÚA CHÙM 24/7 Agent Swarm & Heartbeat Scheduler)

## Architecture
- **4-Layer Clean Architecture**:
  - `seed`: Domain types (`src/seed/types/autonomous-engine.ts`), D1 migration `0437_autonomous_loop_and_heartbeat_scheduler.sql`. Zero upper-layer imports.
  - `tree`: Pure domain logic with zero side-effects (`src/tree/autonomous/state-machine.ts`, `cron-evaluator.ts`, `retry-backoff.ts`, `circuit-breaker.ts`, `task-pipeline.ts`, `swarm-orchestrator.ts`). Zero land/forest imports.
  - `forest`: Existing background job runners and scheduled events (`src/forest/cron/`).
  - `land`: Server actions (`src/land/autonomous/loop-actions.ts`), UI cockpit components, route controllers (`src/app/[locale]/(admin)/admin/autonomous/page.tsx`).
- **Data Flow**:
  1. Cron Trigger / API Tick / Admin Action → `land/autonomous/loop-actions.ts`
  2. `land` verifies tenant/admin auth, claims execution lease via CAS on D1 `autonomous_loop_state`.
  3. `tree/autonomous/state-machine.ts` transitions state (Idle → Running).
  4. `tree/autonomous/cron-evaluator.ts` checks due tasks from `autonomous_schedule_tasks`.
  5. `tree/governance/agy-policy-engine.ts` enforces MCU limits and token bounds before task execution.
  6. `tree/autonomous/swarm-orchestrator.ts` dispatches tasks to capability handlers (`affiliate-scout`, `content-producer`, `auto-publisher`).
  7. On error: `tree/autonomous/retry-backoff.ts` calculates jittered backoff; retries exhausted → DLQ `autonomous_dead_letter_queue`; 5 consecutive failures → trip circuit breaker.
  8. Execution cycle recorded in `autonomous_cycle_runs`. State transitions back to Idle (or Paused / Circuit-Broken).
  9. UI Cockpit polls / triggers actions via Server Actions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Deterministic FSM | 5-state deterministic state machine (`IDLE`, `RUNNING`, `PAUSED`, `RECOVERING`, `CIRCUIT_BROKEN`) with atomic D1 CAS | M1 | R1 § 1 |
| 2 | Heartbeat Schedule Processor | Edge-safe cron expression parser and interval scheduler based on `openclaw.json` and `HEARTBEAT.md` | M1 | R1 § 2 |
| 3 | Fault Tolerance & DLQ | Auto-retry with exponential backoff & jitter, DLQ preservation, and 2-tier circuit breaker | M1 | R1 § 3 |
| 4 | Swarm Orchestrator | Autonomous agent swarm dispatch: Affiliate Scout (4h), Content Producer (daily 6:00 UTC), Auto-Publisher (event-driven/APAC peak) | M2 | R2 § 1 |
| 5 | Compute & Cost Governance | Strict MCU quota enforcement, per-cycle token bounds, and AGY escalation policies via `tree/governance/` | M2 | R2 § 2 |
| 6 | D1 Audit Logging | Persistent telemetry of cycle runs, actions taken, MCU consumption, consciousness score, and error summaries | M1 | R2 § 3 |
| 7 | Operations Cockpit Controls | Real-time cockpit controls: Start, Pause, Resume, Force Cycle, Emergency Halt | M3 | R3 § 1 |
| 8 | Cycle Metrics Dashboard | Real-time cycle metrics: active agents, tasks executed, MCU consumed, success rates, health status | M3 | R3 § 2 |
| 9 | Bilingual UI (Zero Jargon) | Bilingual VI/EN copy adhering to the Constitution without developer jargon | M3 | R3 § 3 |
| 10 | 4-Layer Purity & TS Invariants | 0 layer boundary violations, 0 TS compiler errors, 0 ESLint errors | M4 | R4 § 1 |
| 11 | 100% Vitest Test Pass Rate | 100% pass rate across unit, integration, and adversarial tests | M4 | R4 § 2 |
| 12 | 9/9 Zero-Bug Certification | Verification proof via `scripts/zero-bug-verify.sh --quick` achieving 9/9 PASS | M4 | R4 § 3 |
| 13 | Live Edge CF Deployment | Cloudflare Workers direct deploy via `./scripts/deploy-with-sha.sh` with bit-for-bit SHA parity and HTTP 200 health check | M4 | R4 § 4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Autonomous Loop Engine | Seed types (`autonomous-engine.ts`), D1 migration `0437`, Tree FSM (`state-machine.ts`), Cron/Interval Scheduler (`cron-evaluator.ts`), Retry/DLQ (`retry-backoff.ts`), Circuit Breaker (`circuit-breaker.ts`), and unit test suite | none | DONE |
| M2 | Swarm Capabilities & Governance Enforcement | Swarm Orchestrator (`swarm-orchestrator.ts`), capability wiring (`affiliate-scout`, `content-producer`, `auto-publisher`), MCU quotas & AGY policy evaluation, D1 audit logging | M1 | DONE |
| M3 | Land Server Actions & Operations Cockpit UI | Land actions (`loop-actions.ts`), UI cockpit (`/admin/autonomous`), bilingual copy in `vi.json` & `en.json`, admin sidebar navigation | M1, M2 | DONE |
| M4 | Zero-Bug Certification & Production Edge Deployment | 100% Vitest pass rate across all suites, 9/9 Zero-Bug verification, Cloudflare Workers edge deploy, live SHA verification, HTTP 200 check | M1, M2, M3 | DONE |

## Interface Contracts

### Seed Types (`src/seed/types/autonomous-engine.ts`)
- `AutonomousEngineState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'RECOVERING' | 'CIRCUIT_BROKEN'`
- `AutonomousStateEvent = 'START' | 'TRIGGER_CYCLE' | 'CYCLE_SUCCESS' | 'NO_TASKS_DUE' | 'TASK_FAILURE' | 'RECOVERY_SUCCESS' | 'MAX_RETRIES_EXCEEDED' | 'CONSECUTIVE_FAILURES' | 'CRITICAL_ERROR' | 'PAUSE_CMD' | 'RESUME_CMD' | 'FORCE_CYCLE_CMD' | 'EMERGENCY_HALT' | 'COOLDOWN_EXPIRED' | 'MANUAL_RESET' | 'BUDGET_EXCEEDED'`
- `transitionAutonomousState(currentState, event, ctx): StateTransitionResult`
- `parseCronExpression(expr): CronRules`, `isCronDue(expr, date, tz): boolean`, `calculateNextCronRun(expr, date, tz): Date`
- `calculateBackoff(attempt, config, jitter): RetryEvaluation`
- `evaluateCircuitStatus(current, action, now): CircuitEvaluationResult`

### Land Server Actions (`src/land/autonomous/loop-actions.ts`)
- `getAutonomousLoopStatusAction(): Promise<ActionResult<AutonomousLoopStateRow & { tasks: AutonomousScheduleTaskRow[], recentRuns: AutonomousCycleRunRow[] }>>`
- `triggerAutonomousCycleAction(options?: { force?: boolean }): Promise<ActionResult<AutonomousCycleTelemetry>>`
- `pauseAutonomousLoopAction(reason?: string): Promise<ActionResult<void>>`
- `resumeAutonomousLoopAction(): Promise<ActionResult<void>>`
- `emergencyHaltAutonomousLoopAction(): Promise<ActionResult<void>>`
- `resetAutonomousCircuitBreakerAction(): Promise<ActionResult<void>>`
- `replayDeadLetterTaskAction(dlqId: string): Promise<ActionResult<void>>`

## Code Layout
- `apps/sophia-ai-factory/src/seed/types/autonomous-engine.ts`
- `apps/sophia-ai-factory/migrations/0437_autonomous_loop_and_heartbeat_scheduler.sql`
- `apps/sophia-ai-factory/src/tree/autonomous/state-machine.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/cron-evaluator.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/retry-backoff.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/circuit-breaker.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/task-pipeline.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/swarm-orchestrator.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/index.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/__tests__/state-machine.test.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/__tests__/cron-evaluator.test.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/__tests__/retry-backoff.test.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/__tests__/circuit-breaker.test.ts`
- `apps/sophia-ai-factory/src/tree/autonomous/__tests__/swarm-orchestrator.test.ts`
- `apps/sophia-ai-factory/src/land/autonomous/loop-actions.ts`
- `apps/sophia-ai-factory/src/land/autonomous/__tests__/loop-actions.test.ts`
- `apps/sophia-ai-factory/src/app/[locale]/(admin)/admin/autonomous/page.tsx`
- `apps/sophia-ai-factory/messages/en.json` (under `autonomous` key)
- `apps/sophia-ai-factory/messages/vi.json` (under `autonomous` key)
- `tests/integration/autonomous-agi-loop.test.ts`
- `tests/adversarial/autonomous-agi-loop.test.ts`
