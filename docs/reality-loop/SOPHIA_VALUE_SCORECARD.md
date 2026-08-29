# SOPHIA VALUE SCORECARD

> **Status:** Phase B draft — metrics defined, instrumentation blocked on Phase C events.
> **Scope:** Minimum measurable evidence that Sophia delivers real creative + economic leverage.
> **Doctrine:** Every metric below maps to >=1 Phase C canonical event. Metrics without a backing event are marked `NO EVENT YET — blocked on Phase C`. No fabricated metrics. Missing values render `—`, never invented.
> **Determinism note:** All metrics derive from **event queries**, not from checkpoint/status fields. Event stream is the source of truth; checkpoints are derived caches.
> **Privacy note — `metrics_json` allowlist:** may carry aggregate counts, cost cents, token counts, durations, enum tags. **NEVER** carry prompts, model output text, raw user input, secrets, or customer PII.

---

## EVENT AVAILABILITY MAP (verified in source)

Phase C canonical events are not yet uniformly wired. Current coverage:

| Canonical event | Exists in source? | File evidence |
|---|---|---|
| `mission.created` | YES | `seed/types/creative-economy/events.ts:38` + 4 consumers |
| `mission.abandoned` | **NO** | grep returned 0 hits in `src/` |
| `agent.started` | **NO** | 0 hits (note: `agent.mission.started` exists in `seed/inngest/agent-event-types.ts` but is NOT the canonical Phase C name) |
| `agent.failed` | **NO** | 0 hits (note: `agent.mission.failed` exists in `seed/inngest/agent-event-types.ts`) |
| `approval.requested` | YES | `seed/inngest/event-types.ts:236` |
| `approval.approved` | **NO** | `agent.approval.resolved` exists (covers both approve/reject via `status` field) — see Group 4 notes |
| `approval.rejected` | PARTIAL | same resolved event, `status: "rejected"` (`agent-event-types.ts:47`) |
| `creative.accepted` | **NO** | `asset.approved` exists in `creative-economy/events.ts:42` but is NOT the canonical Phase C name |
| `creative.edited` | **NO** | 0 hits |
| `creative.rejected` | **NO** | `asset.rejected` exists in `creative-economy/events.ts:43` but is NOT the canonical Phase C name |
| `memory.used` | **NO** | `memory.updated` exists in `creative-economy/events.ts:49` but is NOT the canonical Phase C name |
| `memory.corrected` | **NO** | 0 hits |
| `mission.cost_recorded` | **NO** | `recordSpend(id, amountCents)` API exists in `tree/mission/repository.ts:183` — persists cost but emits NO Inngest event |

Implication: most groups below are **blocked on Phase C wiring**. Existing proximate events are listed under each group for gap visibility. Do not treat the existing events as canonical until Phase C aligns names.

---

## GROUP 1 — TIME LEVERAGE

**Definition:** Human time saved by Sophia vs human time without Sophia. Expressed as a ratio (machine-vs-manual) and absolute median minutes.

**Formulas:**
- `human_time_without_sophia` — **SELF-REPORTED** (`estimate` tag). Not machine-measured. Captured only via Design Partner survey (Phase D).
- `human_time_with_sophia` — **SELF-REPORTED** (`estimate` tag).
- `machine_vs_manual_ratio` = `machine_execution_seconds / human_approval_seconds` (machine-measurable).
- `median_human_time_per_approval` = median time between `approval.requested` and `approval.resolved` timestamps, per mission.
- `median_mission_wall_clock_minutes` = median of (`mission.completed` - `mission.created`) across missions.

**Source events:** `mission.created`, `mission.completed` (proximate), `approval.requested`, `approval.resolved` (proximate).

**Targets:** `median_human_time_per_approval` < 120s (design partner can approve quickly); `machine_vs_manual_ratio` > 5:1 (machine does most of the work).

**Notes:**
- `human_time_without_sophia` and `human_time_with_sophia` are ALWAYS tagged `estimate`. Never report them as measured fact.
- Machine-measurable subset (`median_human_time_per_approval`, `median_mission_wall_clock`) is available once Phase C events land.
- **Blocked metrics:** `human_time_without_sophia`, `human_time_with_sophia` — require Design Partner survey (Phase D).

---

## GROUP 2 — CREATIVE ACCEPTANCE

**Definition:** How often humans accept, edit, or reject Sophia's creative output.

**Formulas:**
- `suggestions_proposed` = count of creative outputs presented for human review.
- `suggestions_accepted` = count where human chose accept.
- `suggestions_edited` = count where human chose edit (accepted after modification).
- `suggestions_rejected` = count where human chose reject.
- `acceptance_rate` = `accepted / (accepted + rejected + edited)`. Denominator excludes still-pending.

**Source events:** `creative.accepted`, `creative.edited`, `creative.rejected` (all Phase C canonical — **none exist yet**).

**Targets:** `acceptance_rate` > 0.6 (60% of suggestions accepted without rejection).

**Notes:**
- Proximate existing event: `asset.approved` / `asset.rejected` in `creative-economy/events.ts:42-43`. These are NOT the canonical Phase C names — do not conflate until Phase C aligns.
- `suggestions_proposed` requires a "creative presented" event that does not yet exist.
- **All 4 metrics blocked on Phase C.**

---

## GROUP 3 — MISSION SUCCESS

**Definition:** Whether missions complete, fail, or get abandoned.

**Formulas:**
- `mission_started` = count of `mission.created`.
- `mission_completed` = count of `mission.completed` (proximate: `agent.mission.completed` exists in `agent-event-types.ts:54`).
- `mission_abandoned` = count of `mission.abandoned` (**NO EVENT YET**).
- `mission_resumed` = count of resume-after-pause transitions (no dedicated event yet).
- `completion_rate` = `completed / (completed + abandoned + failed)`.

**Source events:** `mission.created` (exists), `mission.completed` (proximate exists), `mission.abandoned` (**NO EVENT YET**), `mission.failed` (proximate: `agent.mission.failed` exists).

**Targets:** `completion_rate` > 0.7.

**Notes:**
- `mission_abandoned` is the critical missing signal — without it, completion rate is overstated (abandoned missions silently drop out of numerator AND denominator).
- `mission_resumed` requires a resume event not yet defined.
- **Partially blocked on Phase C** (abandoned + resume events missing).

---

## GROUP 4 — HUMAN INTERVENTION

**Definition:** How often humans must step in to approve, reject, or override.

**Formulas:**
- `approval_required` = count of `approval.requested`.
- `approval_granted` = count of `approval.approved` (proximate: `agent.approval.resolved` with `status: "approved"`).
- `approval_rejected` = count of `approval.rejected` (proximate: `agent.approval.resolved` with `status: "rejected"`).
- `human_override` = count of human-initiated overrides (no event yet).
- `intervention_ratio` = `approval_required / mission_completed`.

**Source events:** `approval.requested` (exists), `approval.approved` (proximate via resolved event), `approval.rejected` (proximate via resolved event).

**Targets:** `intervention_ratio` < 2.0 (fewer than 2 approval gates per completed mission).

**Notes:**
- Existing `agent.approval.resolved` event (`agent-event-types.ts:42-51`) carries `status: "approved" | "rejected"` — functionally equivalent to the two canonical events, but name differs. Phase C should align.
- `human_override` has **NO EVENT YET** — blocked on Phase C.

---

## GROUP 5 — CREATIVE MEMORY VALUE

**Definition:** Whether Creative Memory is used, helpful, corrected, or rejected by humans.

**Formulas:**
- `memory_used` = count of `memory.used`.
- `memory_helpful` = count of human "helpful" feedback on memory usage.
- `memory_corrected` = count of `memory.corrected`.
- `memory_rejected` = count of human "not useful" feedback on memory usage.
- `correction_rate` = `memory_corrected / memory_used`.

**Source events:** `memory.used` (**NO EVENT YET**), `memory.corrected` (**NO EVENT YET**).

**Targets:** `correction_rate` < 0.10 (fewer than 10% of memory usages require correction).

**Notes:**
- Proximate existing event: `memory.updated` in `creative-economy/events.ts:49`. This records that memory changed, NOT that it was used in a mission context, NOT that a human judged it. Do not conflate.
- `memory_helpful` / `memory_rejected` require structured human feedback (Phase E).
- **All 4 metrics blocked on Phase C + Phase E.**

---

## GROUP 6 — ECONOMIC VALUE

**Definition:** Measurable economic outcomes — leads, conversions, revenue, cost, ROI.

**Formulas:**
- `leads` = count of qualified leads attributed to a mission.
- `conversions` = count of conversions attributed.
- `revenue` = sum of attributed revenue cents.
- `creative_cost` = sum of `recordSpend` totals (`tree/mission/repository.ts:183`).
- `estimated_roi` = `(revenue - creative_cost) / creative_cost` — **only when both revenue AND cost are present**. Missing either renders `—`.

**Source events:** `mission.cost_recorded` (**NO EVENT YET** — `recordSpend` persists but emits no event), `revenue.attributed` (exists in `creative-economy/events.ts:47`).

**Targets:** `estimated_roi` > 1.0 (revenue exceeds cost) — measured only where data exists.

**Notes:**
- `recordSpend` API exists and persists cost to DB, but emits NO Inngest event. Phase C must add `mission.cost_recorded` event emission to `recordSpend` or its callers.
- `leads` and `conversions` have **NO EVENT YET** — blocked on Phase C + Phase H (CreativeEconomicSnapshot).
- `estimated_roi` is **NOT fabricated**. If revenue is missing → render `—`. If cost is missing → render `—`.
- Source of truth for cost: `recordSpend` totals only. Source of truth for revenue: existing revenue bridges (`revenue.attributed` event) only.
- **Partially blocked on Phase C + Phase H.**

---

## GROUP 7 — AUTONOMY QUALITY

**Definition:** How well agents execute without failing, retrying, or needing human correction.

**Formulas:**
- `agent_action_success_rate` = `successful_agent_actions / total_agent_actions`.
- `retry_rate` = `retried_agent_actions / total_agent_actions`.
- `human_correction_rate` = `human_corrections / total_agent_actions`.
- `rollback_rate` = `rollbacks / total_agent_actions`.

**Source events:** `agent.started` (**NO EVENT YET**), `agent.failed` (**NO EVENT YET**).

**Targets:** `agent_action_success_rate` > 0.85; `retry_rate` < 0.10; `rollback_rate` < 0.05.

**Notes:**
- Proximate existing events: `agent.mission.started` and `agent.mission.failed` in `seed/inngest/agent-event-types.ts`. These are mission-level, not action-level — granularity mismatch.
- `human_correction_rate` requires `memory.corrected` or equivalent (Group 5).
- `rollback_rate` has **NO EVENT YET**.
- **All 4 metrics blocked on Phase C** (action-level events missing).

---

## GROUP 8 — COST EFFICIENCY

**Definition:** Cost per mission, per agent, per model, per completed mission.

**Formulas:**
- `mission_cost` = total cost cents per mission (from `recordSpend`).
- `agent_cost` = cost attributed to a specific agent.
- `model_cost` = cost attributed to a specific model/provider.
- `cost_per_completed_mission` = `total_cost_cents / mission_completed_count`.

**Source events:** `mission.cost_recorded` (**NO EVENT YET**).

**Targets:** `cost_per_completed_mission` < $5.00 (500 cents) per completed mission — initial ceiling, revisit after first 10 design-partner missions.

**Notes:**
- `recordSpend` API exists (`tree/mission/repository.ts:183`) and persists cost, but emits NO event. Phase C must add `mission.cost_recorded`.
- `agent_cost` and `model_cost` require cost attribution fields not yet present in `recordSpend` signature (only `id` + `amountCents`).
- **All 4 metrics blocked on Phase C.**

---

## SUMMARY — BLOCKED METRICS

| Group | Blocked metrics | Blocking dependency |
|---|---|---|
| 1 Time Leverage | `human_time_without/with_sophia` | Phase D (survey) |
| 2 Creative Acceptance | all 4 | Phase C (creative.accepted/edited/rejected) |
| 3 Mission Success | `mission_abandoned`, `mission_resumed` | Phase C |
| 4 Human Intervention | `human_override` | Phase C |
| 5 Creative Memory | all 4 | Phase C + Phase E |
| 6 Economic Value | `leads`, `conversions`, `cost_event` | Phase C + Phase H |
| 7 Autonomy Quality | all 4 | Phase C (action-level) |
| 8 Cost Efficiency | all 4 | Phase C (mission.cost_recorded) |

**Bottom line:** 0 of 8 groups is fully measurable today. Phase C (canonical events) is the unblocking dependency for all groups. Phase D/E/H unblock the remainder.

---

## CROSS-REFERENCE — METRIC TO EVENT MAP

| Metric | Canonical event(s) required |
|---|---|
| `median_human_time_per_approval` | `approval.requested`, `approval.approved`/`rejected` |
| `median_mission_wall_clock` | `mission.created`, `mission.completed` |
| `acceptance_rate` | `creative.accepted`, `creative.edited`, `creative.rejected` |
| `completion_rate` | `mission.created`, `mission.completed`, `mission.abandoned` |
| `intervention_ratio` | `approval.requested`, `approval.approved`, `mission.completed` |
| `correction_rate` | `memory.used`, `memory.corrected` |
| `estimated_roi` | `mission.cost_recorded`, `revenue.attributed` |
| `agent_action_success_rate` | `agent.started`, `agent.failed` |
| `cost_per_completed_mission` | `mission.cost_recorded`, `mission.completed` |

---

PHASE B WRITTEN: /Users/macbook/sophia-ai-factory/docs/reality-loop/SOPHIA_VALUE_SCORECARD.md
