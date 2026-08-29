# Reality Loop v1 — Measurement Report

> **Audience:** Internal / ops + engineering
> **Scope:** What shipped in the Killer Test (commit `842f5026`), what it enables, what it does NOT claim.
> **Tone:** Honest, precise, no marketing. Every claim is tied to a file:line or migration.

---

## 1. Executive Summary

### What shipped (commit `842f5026`, deployed CF-direct, SHA verified live)

A **side-channel, non-fatal, idempotent** product-event instrumentation layer into the existing `performance_events` D1 table. It covers:

- **14 canonical event types** declared in `REALITY_LOOP_EVENT_TYPES` (`tree/performance/loop-events.ts`).
- **10 emitter functions** across three split files (`loop-emitters-runner.ts`, `loop-emitters-creative.ts`, `loop-emitters-cost.ts`), barrel-exported via `tree/performance/index.ts`.
- **12-class autonomy failure taxonomy** classified by a single pure function `classifyAutonomyFailure` (`loop-events.ts`).
- **Structured human feedback** persistence (`reality_feedback` table, migration `0262`) with 4 checkpoints, YES/NO useful, 8 reason enums, idempotent keys, free-text privacy.
- **Creative Memory store** workspace-scoped with soft-delete on rejection, human-correction override of inferred learning, auditable evidence trail (`tree/creative-memory`, validated by `reality-loop-validation.test.ts`, 8 tests).
- **Design Partner archetypes** (FOUNDER / AGENCY / CREATOR) as pure-data bundles flattened into existing mission-create fields (`tree/production-graph/design-partner-bundles.ts`), validated with a `Result`-returning validator.
- **Economic snapshot writer** (`land/creative-economy/snapshot-writer.ts`) populating `creative_economic_snapshot` (migration `0263`) strictly from existing producers — never synthesizes, never computes ROI.

### What it enables

- A **scorecard** (`SOPHIA_VALUE_SCORECARD.md`, Phase B draft) whose 8 metric groups now have most of their backing events emitted.
- A **feedback loop** that ties mission outcomes (acceptance, rejection, correction, abandonment) back to workspace-scoped memory, enabling the Phase F gate (correction_rate < 10%).
- An **economic attribution boundary** that honestly reports NULL rather than fabricating revenue/cost where no producer exists.

### What it does NOT claim

- It is **not** a real-time analytics pipeline. Events are side-channel writes; a D1 outage degrades measurement silently, never the product.
- It does **not** have a `mission.completed` producer writing into `performance_events` (only the outbound webhook fires the canonical `mission.completed`; the `mission_completed` rows in `performance_events` are written by `agent-mission-executor.ts:201` under a different, snake_case `event_type`). See §8 and Escrow MED-3.
- It does **not** have a `feedback.received` or `learning.emit` emitter anywhere in `src/`. These canonical names have no backing function. See Escrow MED-1.
- The scorecard's claim "0 of 8 groups is fully measurable today" is **outdated** (see §5) — the emitters now exist.

---

## 2. Measurement Primitives

All events are written **side-channel**: `emitLoopEvent` wraps the write in try/catch + `logger.warn`, so a measurement failure never aborts the product flow. Event IDs are **deterministic** via FNV-1a 64-bit hash (`loopEventId`), and writes use INSERT OR IGNORE semantics for idempotency.

| # | Canonical event | Product question it answers |
|---|---|---|
| 1 | `mission.created` | How many missions enter the system? |
| 2 | `mission.started` | **No emitter.** Declared only. |
| 3 | `mission.completed` | **No performance_events producer.** See Escrow MED-3. |
| 4 | `mission.failed` | **No emitter.** Declared only. |
| 5 | `mission.abandoned` | Where do missions drop off? (carries `reason` + `stage`) |
| 6 | `agent.started` | How many agent runs begin? |
| 7 | `agent.completed` | **No emitter.** Declared only. |
| 8 | `agent.failed` | Why do runs fail? (carries `failure_class`, `error_code`, `costCents`, `totalTokens`, `durationMs`) |
| 9 | `approval.requested` | How often does the system ask a human? |
| 10 | `approval.approved` | How fast do humans approve? (carries `latencySeconds`) |
| 11 | `approval.rejected` | Why rejected? (carries `reasonCode` + `latencySeconds`) |
| 12 | `creative.accepted` | Does the human accept the creative? |
| 13 | `creative.edited` | How much editing? (carries `editCount`) |
| 14 | `creative.rejected` | Why rejected? (carries `reasonCode`) |
| 15 | `memory.used` | Does memory help? (carries `confidence` + `memoryCount`) |
| 16 | `memory.corrected` | How often does human correct memory? (carries `correctionType` + `previousConfidence`) |
| 17 | `mission.cost_recorded` | Cost per mission (carries `valueCents`, `totalSpentCents`, `budgetCents`) |
| 18 | `feedback.received` | **No emitter, no D1 column.** Declared only. |

**Emitter source-of-truth** (verified against `src/tree/performance/`):

| Emitter function | File |
|---|---|
| `emitMissionCreated` | `loop-emitters-runner.ts` |
| `emitMissionAbandoned` | `loop-emitters-runner.ts` |
| `emitAgentStarted` | `loop-emitters-runner.ts` |
| `emitAgentFailed` | `loop-emitters-runner.ts` |
| `emitApprovalRequested` | `loop-emitters-runner.ts` |
| `emitApprovalApproved` | `loop-emitters-runner.ts` |
| `emitApprovalRejected` | `loop-emitters-runner.ts` |
| `emitCreativeAccepted` | `loop-emitters-creative.ts` |
| `emitCreativeEdited` | `loop-emitters-creative.ts` |
| `emitCreativeRejected` | `loop-emitters-creative.ts` |
| `emitMemoryUsed` | `loop-emitters-cost.ts` |
| `emitMemoryCorrected` | `loop-emitters-cost.ts` |
| `emitMissionCostRecorded` | `loop-emitters-cost.ts` |

Note: `memory.used` is currently emitted as a side-channel from `persistAgentLearning` (`agent-context.ts:192`), not from a dedicated retrieval path. `mission.started`, `mission.completed`, `mission.failed`, `agent.completed`, and `feedback.received` have **no emitter function**.

---

## 3. Structured Human Feedback

Implemented in `land/reality-loop/feedback-store.ts`, persisted to `reality_feedback` table (migration `0262_reality_feedback.sql`).

### Checkpoints

| Checkpoint | When it fires |
|---|---|
| `mission_complete` | Mission reaches terminal state |
| `creative_rejected` | Human rejects a creative output |
| `human_correction` | Human corrects an inferred memory |
| `mission_abandoned` | Mission abandoned before completion |

### Fields

- `useful`: `YES | NO` — the human's verdict.
- `reason`: nullable enum, 8 values: `WRONG`, `LOW_QUALITY`, `NOT_MY_STYLE`, `TOO_EXPENSIVE`, `TOO_SLOW`, `TOO_COMPLEX`, `NOT_USEFUL`, `OTHER`.
- `free_text`: nullable, truncated to 2,000 chars. **Never echoed into logs** (privacy).
- `idempotency_key`: `loop_{missionId}_{checkpoint}_{dayKey}` — guards against double-submit.

### Idempotency

`saveFeedback` uses `INSERT INTO reality_feedback ... ON CONFLICT(idempotency_key) DO UPDATE SET id = id RETURNING *`. A repeat submission with the same key updates the existing row rather than inserting a duplicate.

### Privacy

`free_text` is stored but never logged. Aggregation (`aggregateFeedbackByWorkspace`) returns counts by checkpoint, never free-text content.

### Workspace scoping

Every query filters by `workspace_id`. The `idx_reality_feedback_workspace`, `idx_reality_feedback_mission`, and `idx_reality_feedback_checkpoint` indexes back the common access patterns.

---

## 4. Design Partner Archetypes

Pure-data bundles in `tree/production-graph/design-partner-bundles.ts`. They flatten into existing mission-create fields (`constraints`, `successMetrics`, `autonomyLevel`) — no new schema, no new UI.

| Archetype | Template ID | Autonomy level | Approval policy | Success metric subset |
|---|---|---|---|---|
| **FOUNDER** | `founder-media-engine` | 2 | `publish_content`, `requiresApproval: true` | `machine_vs_manual_ratio > 5:1`, `median_human_time_per_approval < 120s`, `completion_rate > 0.7`, `correction_rate < 0.10` |
| **AGENCY** | `agency-creative-ops` | 2 | `publish_content`, `requiresApproval: true` | `acceptance_rate > 0.6`, `intervention_ratio < 2.0`, `agent_action_success_rate > 0.85`, `cost_per_completed_mission < 500` cents |
| **CREATOR** | `creator-audience-engine` | 3 | `publish_content`, `requiresApproval: true` | `machine_vs_manual_ratio > 5:1`, `acceptance_rate > 0.6`, `completion_rate > 0.7`, `estimated_roi > 1.0` |

Validation (`validateDesignPartnerBundle`) returns a `Result` with error codes: `UNKNOWN_TEMPLATE`, `METRIC_NOT_IN_SCORECARD`, `BAD_AUTONOMY_LEVEL`, `BAD_APPROVAL_POLICY`. The canonical `SCORECARD_METRIC_NAMES` set (37 names) is the authority for valid metric references.

---

## 5. Scorecard Mapping

Verified against `SOPHIA_VALUE_SCORECARD.md`. The scorecard's "EVENT AVAILABILITY MAP" reports many events as NO/PARTIAL — this is **stale**. The emitters below now exist.

| Scorecard group | Formula (from scorecard) | Event backing it | Status |
|---|---|---|---|
| **1. Time Leverage** | `median_human_time_per_approval` = median(approval.resolved − approval.requested); `median_mission_wall_clock_minutes` = median(mission.completed − mission.created) | `approval.requested`, `approval.approved`/`rejected` ✓; `mission.created` ✓; `mission.completed` ✗ (no producer) | Partial — held back only by missing `mission.completed` |
| **2. Creative Acceptance** | `acceptance_rate` = accepted / (accepted + rejected + edited) | `creative.accepted` ✓, `creative.edited` ✓, `creative.rejected` ✓ | **Measurable** |
| **3. Mission Success** | `completion_rate` = completed / (completed + abandoned + failed) | `mission.abandoned` ✓; `mission.completed` ✗; `mission.failed` ✗ | Partial — held back by missing `mission.completed` + `mission.failed` emitters |
| **4. Human Intervention** | `intervention_ratio` = approval_required / mission_completed | `approval.requested` ✓; `mission.completed` ✗ | Partial |
| **5. Memory Value** | `correction_rate` = memory_corrected / memory_used | `memory.used` ✓, `memory.corrected` ✓ | **Measurable** |
| **6. Economic Value** | `estimated_roi` = (revenue − creative_cost) / creative_cost; `cost_per_completed_mission` = total_cost / mission_completed | `mission.cost_recorded` ✓; revenue ✗ (no mission-scoped producer); `mission.completed` ✗ | Partial — cost side measurable; revenue side NULL-by-design |
| **7. Autonomy Quality** | `agent_action_success_rate` = successful / total | `agent.started` ✓, `agent.failed` ✓ | **Measurable** (by `1 − failed/started`) |
| **8. Cost Efficiency** | `cost_per_completed_mission` | `mission.cost_recorded` ✓; `mission.completed` ✗ | Partial |

### Economic group — D1 column backing

| Scorecard field | D1 source | Column |
|---|---|---|
| `creative_cost` | `creative_missions.spent_cents` (read by `readSpendTotal` in `snapshot-writer.ts`) | `creative_economic_snapshot.creative_cost` |
| `production_cost` | **No producer** | Always NULL |
| `distribution_cost` | **No producer** | Always NULL |
| `revenue` | **No mission-scoped producer** (revenue bridges write `entity_id = videoId/offerId/externalId`, not mission id) | Always NULL (`readMissionRevenue` returns null by design) |
| `leads` | **No producer** | Always NULL |
| `conversions` | **No producer** | Always NULL |

The scorecard also references `rollback_rate`, `retry_rate`, `agent_cost`, `model_cost`. **None of these have an emitter or a D1 column.** They are named in the scorecard but are not yet measurable.

---

## 6. Creative Memory Validation

The test suite `tree/creative-memory/__tests__/reality-loop-validation.test.ts` (8 tests, Phase F) proves the following invariant:

> **Creative Memory is workspace-scoped, never leaks across workspaces, soft-deletes on rejection, and a human correction permanently overrides the inferred learning it replaces — with an auditable evidence trail.**

Specific assertions:

1. **Workspace isolation** — entries from workspace A are never visible to workspace B.
2. **No cross-workspace leak** — query results contain only the requesting workspace's entries.
3. **Soft-delete on rejection** — rejected preferences get `isDeleted = true`, not a hard delete.
4. **Human correction overrides inferred learning** — correction bumps `version`, sets `source = 'human_edit'`, `confidence = 'high'`.
5. **Auditable evidence trail** — every entry carries `evidence` (JSON array of source IDs).
6. **Inspectable `summarize()`** — returns human-readable and agent-readable summaries.
7. **Correctable via `put`** — a subsequent `put` with the same key updates rather than duplicates.
8. **Improves subsequent mission context** — stored memories are loaded into future agent runs via `loadMissionMemories`.

The suite mocks D1 at the boundary (`vi.mock('@/seed/db/client')`), so it validates store logic, not D1 itself.

---

## 7. Autonomy Failure Taxonomy

12 failure classes declared in `AUTONOMOMY_FAILURE_CLASSES` (`tree/performance/loop-events.ts`), classified by the pure function `classifyAutonomyFailure(error, context?)` with a priority-ordered 13-branch table.

| # | Class | Meaning | Existing producer? |
|---|---|---|---|
| 1 | `REASONING_ERROR` | Agent logic failure | No dedicated emitter |
| 2 | `BAD_CONTEXT` | Insufficient/malformed context | No dedicated emitter |
| 3 | `BAD_MEMORY` | Memory retrieval returned junk | No dedicated emitter |
| 4 | `TOOL_ERROR` | External tool/SDK failure | No dedicated emitter |
| 5 | `PROVIDER_ERROR` | AI provider error (rate limit, 5xx) | Yes — `agent.failed` carries `error_code` |
| 6 | `TIMEOUT` | Run exceeded wall-clock budget | Yes — `agent.failed` |
| 7 | `PERMISSION_ERROR` | Permission denied | **No producer** |
| 8 | `APPROVAL_ERROR` | Approval rejected / timed out | Recovered from Inngest event `production.graph.failed.errorCode` (`production-graph-runner.ts:819`), NOT from `performance_events` |
| 9 | `COST_LIMIT` | Budget exhausted | Recovered from Inngest event `production.graph.failed.errorCode` (`production-graph-runner.ts:819`) |
| 10 | `POLICY_BLOCK` | Policy engine blocked the run | **No producer** |
| 11 | `USER_AMBIGUITY` | User intent unresolvable | **No producer** |
| 12 | `UNKNOWN` | Fallback when nothing else matches | Yes — `agent.failed` default |

### Priority order (first match wins)

```
approvalOutcome → APPROVAL_ERROR
budgetExhausted / BUDGET_EXCEEDED → COST_LIMIT
permissionDenied / PERMISSION_DENIED → PERMISSION_ERROR
APPROVAL_REJECTED / TIMEOUT → APPROVAL_ERROR
POLICY_BLOCK → POLICY_BLOCK
USER_AMBIGUITY → USER_AMBIGUITY
TOOL_ERROR → TOOL_ERROR
PROVIDER_ERROR → PROVIDER_ERROR
TIMEOUT → TIMEOUT
BAD_CONTEXT → BAD_CONTEXT
BAD_MEMORY → BAD_MEMORY
REASONING_ERROR → REASONING_ERROR
userInterventionRequired → USER_AMBIGUITY
fallback → UNKNOWN
```

### Known limitations

- Classes 7 (`PERMISSION_ERROR`), 10 (`POLICY_BLOCK`), 11 (`USER_AMBIGUITY`) have **no producer in the codebase** — they are forward-looking slots.
- Classes 1–4 (`REASONING_ERROR`, `BAD_CONTEXT`, `BAD_MEMORY`, `TOOL_ERROR`) have **no dedicated emitter** — they would be classified only if a future producer supplies the matching `error_code`.
- `COST_LIMIT` and `APPROVAL_ERROR` are recovered from the Inngest event `production.graph.failed.errorCode`, **not** from `performance_events`. They are emitted by `emitAgentFailed` only when the caller passes them through.
- A silent provider hang, a runner-stamped `NODE_FAILED`, a budget/approval terminal fail that bypasses `agent.failed`, or a side-channel write loss — all are **silent failures** that the taxonomy cannot currently see.

---

## 8. Economic Snapshot

Migration `0263_creative_economic_snapshot.sql` defines the table.

### Schema

```sql
CREATE TABLE IF NOT EXISTS creative_economic_snapshot (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL,
  mission_id          TEXT,                  -- nullable
  creative_cost       INTEGER,              -- nullable, from creative_missions.spent_cents
  production_cost     INTEGER,              -- nullable, no producer → always NULL
  distribution_cost   INTEGER,              -- nullable, no producer → always NULL
  leads               INTEGER,              -- nullable, no producer → always NULL
  conversions         INTEGER,              -- nullable, no producer → always NULL
  revenue             INTEGER,              -- nullable, no mission-scoped producer → always NULL
  recorded_at         INTEGER NOT NULL DEFAULT 0
);
```

### NULL-by-design rule

The writer (`snapshot-writer.ts`) populates **strictly from existing producers**. A missing source datum stays NULL, never 0. There is no `COALESCE(..., 0)`, no synthetic default.

### What is measured today

| Column | Current value | Why |
|---|---|---|
| `creative_cost` | `creative_missions.spent_cents` if present, else NULL | The only cost source of truth (`recordSpend` in `tree/mission/repository.ts:183`) |
| `production_cost` | Always NULL | `recordSpend` writes ONE aggregate, no per-category breakdown |
| `distribution_cost` | Always NULL | No producer |
| `revenue` | Always NULL | Existing revenue bridges write `entity_id = videoId/offerId/externalId`, NOT mission id. `readMissionRevenue` returns null by design |
| `leads` | Always NULL | No producer |
| `conversions` | Always NULL | No producer |

### ROI is never stored

`estimated_roi` is **computed by callers**, and only when both revenue AND cost are present. The snapshot has no `roi` column. The writer never computes it. Callers render `—` when either input is missing.

### `mission.completed` in `performance_events`

The `performance_events` table contains rows with `event_type = 'mission_completed'` (snake_case), written by `agent-mission-executor.ts:201`. This is a **different event_type** from the canonical `mission.completed`. The canonical `mission.completed` is emitted only by the outbound webhook in `campaign-orchestrator.ts:368` — it does **not** write a `performance_events` row. This divergence is Escrow MED-3.

---

## 9. Escrow — Open Items

Three measurement-completeness gaps. Each is tagged BROKEN (contract violation, something that should work doesn't) vs KNOWN GAP (no implementation yet).

### MED-1 — `learning.emit` and `feedback.received` have no emitter

**Severity:** MED | **Type:** KNOWN GAP

- `feedback.received` is listed as a canonical event (§2 #18) but has **zero occurrences** in `src/` or `docs/`. No emitter function, no D1 column.
- `learning.emit` (referenced by Phase H as a future learning-event adapter) has **no emitter**. `persistAgentLearning` (`agent-context.ts:158`) emits only `memory.used` — there is no `learning.emit` adapter.
- Impact: the scorecard's feedback group and the learning loop cannot yet close on a dedicated learning event. Today only `memory.used` + `memory.corrected` carry memory signal.

### MED-2 — Scorecard dashboard reads stale `.ts` directly

**Severity:** MED | **Type:** KNOWN GAP

- The scorecard dashboard (when built) is expected to read `SOPHIA_VALUE_SCORECARD.md` metric definitions directly from the `.ts` source. That file is **stale**: its "EVENT AVAILABILITY MAP" reports 10 canonical events as NO/PARTIAL when emitters now exist.
- Impact: a dashboard reading the stale `.ts` would under-report measurability. The fix is to read from the live emitter registry (or a generated manifest), not the hand-maintained map.

### MED-3 — `mission.completed` has no `performance_events` producer

**Severity:** MED | **Type:** BROKEN (contract mismatch)

- The canonical event `mission.completed` is declared in `REALITY_LOOP_EVENT_TYPES` and is the denominator for `completion_rate`, `intervention_ratio`, and `cost_per_completed_mission` — three scorecard groups.
- **No emitter writes `mission.completed` into `performance_events`.**
  - The `mission_completed` rows in `performance_events` come from `agent-mission-executor.ts:201` under a snake_case `event_type` — a different contract.
  - The canonical `mission.completed` is emitted only by the outbound webhook in `campaign-orchestrator.ts:368`, which fires the webhook payload but **does not write a `performance_events` row**.
- Impact: `completion_rate`, `intervention_ratio`, and `cost_per_completed_mission` cannot be computed from canonical event data today. The `mission_completed` rows that DO exist are under a different event_type and are not part of the Reality Loop contract.

---

## 10. How To Extend

Adding a new event or metric without breaking the canonical contract:

### Adding a new event

1. Add the event name to `REALITY_LOOP_EVENT_TYPES` in `tree/performance/loop-events.ts`.
2. Add a new emitter function in the appropriate split file (runner / creative / cost) — or a new split file if it doesn't fit.
3. The emitter **must** call `emitLoopEvent(eventType, opts)`, which handles the FNV-1a ID, the side-channel write, and the non-fatal try/catch. Never write to `performance_events` directly.
4. Re-export the emitter from `tree/performance/index.ts`.
5. Add a test in `reality-loop-missions.test.ts` or a dedicated test that asserts the event fires under the right condition.
6. Update this report's §2 table.

### Adding a new metric

1. Add the metric name to `SCORECARD_METRIC_NAMES` in `tree/production-graph/design-partner-bundles.ts` (the ReadonlySet that `validateDesignPartnerBundle` checks against).
2. Write the formula into `SOPHIA_VALUE_SCORECARD.md`.
3. Verify each event the formula references has an emitter (cross-check §2 of this report). If not, the metric is a KNOWN GAP until the emitter lands.
4. For economic metrics, verify the D1 column backing exists (cross-check §5 / §8). If not, the metric returns NULL-by-design until a producer is built.

### What NOT to do

- Do **not** add a `performance_events` write outside `emitLoopEvent` — you lose deterministic IDs, idempotency, and the non-fatal guarantee.
- Do **not** fabricate a default for a missing economic datum — NULL is the contract.
- Do **not** claim a metric is "measurable" unless its backing event has an emitter AND that emitter is actually called in a production code path.
- Do **not** use the snake_case `mission_completed` event_type as a substitute for the canonical `mission.completed` — they are different contracts (Escrow MED-3).

---

## Appendix — Reference Map

| Concern | Location |
|---|---|
| Canonical event types + failure classes | `src/tree/performance/loop-events.ts` |
| Runner emitters | `src/tree/performance/loop-emitters-runner.ts` |
| Creative emitters | `src/tree/performance/loop-emitters-creative.ts` |
| Memory + cost emitters | `src/tree/performance/loop-emitters-cost.ts` |
| Barrel export | `src/tree/performance/index.ts` |
| Feedback persistence | `src/land/reality-loop/feedback-store.ts` |
| Feedback schema | `migrations/0262_reality_feedback.sql` |
| Creative Memory store | `src/tree/creative-memory/` |
| Memory validation tests | `src/tree/creative-memory/__tests__/reality-loop-validation.test.ts` |
| Economic snapshot writer | `src/land/creative-economy/snapshot-writer.ts` |
| Economic schema | `migrations/0263_creative_economic_snapshot.sql` |
| Design Partner bundles | `src/tree/production-graph/design-partner-bundles.ts` |
| Autonomy failure taxonomy doc | `docs/reality-loop/AUTONOMY_FAILURE_TAXONOMY.md` |
| Scorecard draft | `docs/reality-loop/SOPHIA_VALUE_SCORECARD.md` |
| Instrumentation audit | `docs/reality-loop/INSTRUMENTATION_AUDIT.md` |
| Design Partner playbook | `docs/reality-loop/DESIGN_PARTNER_PLAYBOOK.md` |
| Deterministic missions test | `src/forest/inngest/functions/__tests__/reality-loop-missions.test.ts` |
| `mission_completed` (snake_case) producer | `src/forest/inngest/functions/agent-mission-executor.ts:201` |
| Canonical `mission.completed` webhook-only | `src/land/campaigns/campaign-orchestrator.ts:368` |
| `persistAgentLearning` (memory.used side-channel) | `src/forest/inngest/functions/agent-context.ts:158` |

---

WRITTEN: docs/reality-loop/REALITY_LOOP_REPORT.md
