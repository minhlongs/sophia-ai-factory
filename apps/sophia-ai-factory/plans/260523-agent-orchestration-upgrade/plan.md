---
title: "Agent Orchestration Upgrade: Checkpoint, Circuit Breaker, Prompt Contracts"
description: "Add checkpoint/resume, circuit breaker with bounded retry, and typed prompt contracts to multi-agent orchestration"
status: pending
priority: P2
effort: 6h
branch: master
tags: [multi-agent, orchestration, resilience, prompt-contracts]
created: 2026-05-23
---

# Agent Orchestration Upgrade

## Problem

The multi-agent coordinator (`tree/sop/multi-agent-coordinator.ts`) and fleet spawner (`lib/openclaw/spawn-agent-fleet.ts`) lack resilience primitives. Three gaps:

1. **No checkpoint/resume** — task failure requires full session restart (research: 40% of multi-agent failures = lost handoff state)
2. **No circuit breaker / retry** — fleet spawner has zero error resilience; one failure = one failure, no recovery
3. **No prompt contracts** — tasks dispatched with freeform `prompt: string`, no validation (research: structured contracts reduce misclassification 22% to 4%)

## Existing Assets (DO NOT duplicate)

| Asset | Location | Reuse? |
|-------|----------|--------|
| Circuit breaker (video) | `lib/video/circuit-breaker.ts:1-107` | **Promote** to `seed/utils/` — same pattern, different callers |
| SmartResumeEngine | `tree/gateway/smart-resume-engine.ts:1-206` | **Reference pattern** — uses Supabase; we need D1-native |
| Campaign checkpoints table | `migrations/0140_create_campaign_checkpoints.sql` | **Separate** — campaign vs agent checkpoints are distinct concerns |
| Fulfillment circuit breaker | `lib/fulfillment/circuit-breaker.ts` | **Will import** promoted seed version |

## Phases

| # | Phase | Layer Impact | Effort | Status |
|---|-------|-------------|--------|--------|
| 1 | [Checkpoint/Resume](phase-01-checkpoint-resume.md) | seed (types, migration) + tree (coordinator) | 2h | pending |
| 2 | [Circuit Breaker + Retry](phase-02-circuit-breaker-retry.md) | seed (utils) + lib (fleet spawner) | 2h | pending |
| 3 | [Prompt Contracts](phase-03-prompt-contracts.md) | seed (types/validators) + lib (fleet spawner) | 2h | pending |

## Dependency Graph

```
Phase 1 (checkpoint) ── independent
Phase 2 (circuit breaker) ── independent
Phase 3 (prompt contracts) ── independent

All three can run in parallel. No cross-phase file conflicts.
```

## Backwards Compatibility

- Phase 1: adds nullable `checkpoint_json` column — existing rows get NULL, no migration downtime
- Phase 2: promotes existing circuit breaker to seed; old `lib/video/` callers re-export from seed — zero breaking changes
- Phase 3: prompt validation is opt-in via `validatePromptContract()` call in fleet spawner; existing `prompt: string` field remains

## Rollback

- Phase 1: `ALTER TABLE agent_task_assignments DROP COLUMN checkpoint_json` + revert coordinator changes
- Phase 2: revert seed util + fleet spawner changes; lib/video/ still works standalone
- Phase 3: remove Zod schemas + validation call; fleet spawner falls back to unvalidated dispatch

## Success Criteria

1. Checkpoint: coordinator saves/loads JSON checkpoint per task; resume from last checkpoint on retry
2. Circuit breaker: fleet spawner trips after N consecutive failures; exponential backoff retry with max 3 attempts
3. Prompt contracts: Zod schema per AgentRole; fleet spawner validates before dispatch; invalid prompts rejected with actionable error

## Test Matrix

| Component | Unit Test | Integration |
|-----------|-----------|-------------|
| `saveCheckpoint` / `loadCheckpoint` | Mock D1 | D1 batch in coordinator |
| `withBreaker` (promoted) | Existing tests + new edge cases | Fleet spawner circuit trip |
| `withRetry` | Backoff timing, max attempts | Fleet spawner retry chain |
| Zod prompt schemas | Schema validation per role | Fleet spawner dispatch rejection |
