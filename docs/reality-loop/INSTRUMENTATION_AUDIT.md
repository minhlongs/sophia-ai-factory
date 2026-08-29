# Phase A — Product Instrumentation Audit

> Inventory of all telemetry / analytics / events / logs / agent-traces /
> performance-events / cost-records / approval-records / mission-history in
> `apps/sophia-ai-factory/src`. Source-verified, file:line-cited. Internal doc.

---

## 1. CURRENT EVENTS

### 1.1 `performance_events` table (tree/performance/events.ts)
Schema: `id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, metrics_json, recorded_at, raw_data`. Writer: `recordPerformanceEvent` / `recordPerformanceEventIdempotent` (`events.ts:84,123`).

| event_type string | writer (file:line) | rawData payload |
|---|---|---|
| `revenue` | `src/land/analytics/revenue-ingestion.ts:90` | `{source:'youtube-analytics', date}` |
| `conversion` | `src/land/analytics/tiktok-revenue-ingestion.ts:90` | `{source, conversionEventId, tenantId, grossAmountUsd, commissionUsd}` |
| `sponsorship` | `src/land/ingestion/revenue-events.ts:77` (source==='sponsorship') | `{source, externalId, currency, ...metadata}` |
| `mission_completed` | `src/forest/inngest/functions/agent-mission-executor.ts:201` | `{agentId, totalTokens, runId}` |
| `graph_node_completed` | `src/forest/inngest/functions/production-graph-runner.ts:669` | `{graphRunId, nodeId, agentSlug, totalTokens, durationMs}` |

> Note: `impression` is read by `creative-economy/dashboard-summary.ts:68` and
> `asset-performance.ts:71` but NO producer was found in src — likely a legacy /
> external ingest. Verify before relying on it.

### 1.2 `signals_events` table (forest/telemetry/track.ts:47)
Writer: `track()` fire-and-forget. Schema: `id, ts, event_type, actor, org_id, props_json`. All event types enumerated in `forest/telemetry/d1-event-types.ts:11-37`:

`tier_conversion`, `payment_success`, `payment_failed`, `agent_dispatch`, `api_rate_limit_hit`, `byok_call`, `byok_timeout`, `local_mode_provisioned`, `local_mode_healthy`, `local_mode_unhealthy`, `local_mode_disabled`, `workflow_started`, `workflow_step_completed`, `workflow_completed`, `workflow_failed`, `prompt_injection_detected`, `llm_call_trace`, `byok_key_set`, `byok_key_cleared`, `discovery_score_requested`, `agent_task_start`, `agent_task_complete`, `agent_task_fail`, `agent_feedback`, `checkout_started`.

Emitters (prod): `tree/agents/runner.ts:128,181,200`, `forest/agents/runner.ts:136`, `tree/byok/with-timeout.ts:83,93,101`, `tree/gateway/openclaw-gateway.ts:161`, `seed/observability/telemetry/llm-trace.ts:88`, `app/api/discovery/score/route.ts:73`, `app/api/agents/feedback/route.ts:74`, `app/api/user/byok/route.ts:94,133`, `app/api/webhooks/payos/route.ts:237,243`, `app/api/webhooks/nowpayments/route.ts:201,214,237`, `app/api/cron/workflow-stepper/*.ts:77,90,124,149`, `middleware-api-handler.ts:67`.

### 1.3 PostHog events (forest/telemetry/event-types.ts:9-32)
Client-safe: `signup, pageview, cta_click, wizard_step, wizard_completed, byok_configured, campaign_created, campaign_published, video_rendered, first_video_started, first_video_completed, experiment_assigned, sop_installed, referral_signup`. Server-only (captured via `posthog-capture.ts`): `tier_upgraded, payment_succeeded, churn_signal, free_quota_exhaustion`.

### 1.4 Approval records
`agent_approvals` table — written by `tree/mission/agent-run-repo.ts:302` (`INSERT INTO agent_approvals`). Status lifecycle `pending→approved/rejected`. Read by `land/production-monitoring/dashboard-summary.ts:95-119` for turnaround + pending counts.

### 1.5 Agent execution traces
- `llm_call_trace` signals event (`seed/observability/telemetry/llm-trace.ts:88`) — per-step LLM observability (provider, model, tokens, cost_usd, ok).
- `agent_task_start/complete/fail` signals — per-task runner telemetry.
- `production_graph_runs.node_states_json` (migration 0257) — per-node checkpoint states for resume (NOT a telemetry stream; deterministic checkpoint).

### 1.6 Experiment events
- `ab_experiments` / `forest/ab/experiment-store.ts:66` (A/B variant assignment).
- `experiments` + `experiment_variants` + `experiment_results` tables (`tree/performance/experiment.ts:176,196,347`) — structured A/B with `winner_variant_id`, `confidence`, `result`.
- `sop_experiments` / `sop_experiment_assignments` (`tree/sop/experiment-framework.ts:61,137`).

---

## 2. CURRENT METRICS

| metric | source (file:line) | answers |
|---|---|---|
| completionPct | `land/production-monitoring/dashboard-summary.ts:122` | "Do missions finish?" |
| approvalTurnaroundMedianHours | `dashboard-summary.ts:123` | "How long human review takes" |
| retrySuccessPct | `dashboard-summary.ts:125` | "Do retries recover?" |
| avgSpendPerRunCents | `dashboard-summary.ts:126` | "Cost per mission" |
| activeRuns / pendingApprovals | `dashboard-summary.ts:128-129` | "Current load" |
| revenue / cost / net / roiPct (30d) | `land/creative-economy/dashboard-summary.ts:79-91` | "Is the factory profitable?" |
| asset-level ROI ranking | `land/creative-economy/asset-performance.ts:71-88` | "Which assets earn?" |
| per-node cost/tokens/duration | `production-graph-runner.ts:649-688` (`recordNodePerformance`) | "Where does money/time go?" |
| mission spend ledger | `tree/mission/repository.ts:183` (`recordSpend` → `creative_missions.spent_cents`) | "Budget consumed" |
| experiment winner/confidence | `tree/performance/experiment.ts:293-323` (`completeExperiment`) | "Which variant wins?" |
| churn / cohort / funnel | `forest/analytics/churn-calculator.ts:95`, `funnel-stats.ts:331,340` | "Where do users drop?" |
| creative-economy snapshots | `land/creative-economy/*-math.ts`, `memory-insights.ts`, `playbook-health.ts`, `learning-velocity.ts` | "Creative health over time" |

---

## 3. CURRENT GAPS (vs 10 product questions)

| product question | gap (missing signal) |
|---|---|
| Solve problem | No event tagging which mission type solved which customer problem |
| Save time | No "time-to-first-value" event (mission start → first usable output) |
| Improve creative | No structured creative-quality signal beyond revenue/impressions |
| Improve economics | No cost-attribution bridge from `graph_node_completed` to asset revenue |
| Memory helps | No event measuring memory retrieval → output quality delta |
| Human reject | `agent_approvals` has status but NO reason enum (approved/rejected only, no rejection category) |
| Autonomy fail | No `autonomy_failed` event; `workflow_failed` + `agent_task_fail` are closest but not autonomy-specific |
| Workflow break | No end-to-end workflow-health event (start→completed/failed ratio over time) |
| Minimum lovable workflow | No "time-to-first-video" or "wizard→first-mission" funnel event |
| What NOT build | No "abandoned mission" event (mission created but never run) |

---

## 4. DUPLICATE TELEMETRY

**Confirmed overlaps (≥1):**

1. **Lane G KPI modules vs `land/dashboard-summary` overlap** (given). `land/production-monitoring/dashboard-summary.ts` computes the six production KPIs from `production_graph_runs`+`agent_approvals`. The forest `admin-billing-summary-kpi.tsx` renders MRR / revenue-30d / overage / refunds from billing tables — different domain, but `activeRuns` and `pendingApprovals` are derivable from both. **Verdict: partial overlap on run/approval counts; revenue numbers come from disjoint sources (billing vs performance_events).**

2. **`creative-economy/dashboard-summary.ts:66-77` vs `creative-economy/asset-performance.ts:65-89`** — both `SELECT ... FROM performance_events WHERE workspace_id` summing `revenue/conversion/impression/mission_completed` over a 30d window. The dashboard does workspace-wide aggregation; asset-performance groups by `asset_id`. **Verdict: same query, different GROUP BY — duplicate reads, candidate to unify behind one materialized view or shared aggregation.**

3. **`revenue` event_type written by two bridges** — `land/analytics/revenue-ingestion.ts:90` (YouTube) and `land/ingestion/revenue-events.ts:77` (generic, source≠sponsorship). Both write `event_type='revenue'` into `performance_events`. **Verdict: intentional dual-producer on one event_type; idempotency via deterministic id (`rev_{userId}_{videoId}_{date}` vs `revenue_{source}_{externalId}`).**

4. **`agent_task_complete` (signals) vs `graph_node_completed` (performance_events)** — both fire on successful agent execution. Different tables, different granularity (task vs graph-node). **Verdict: overlap in "success" signal; cost data only in the latter.**

> Phase C reuse note: duplicates #2 and #4 sit on `performance_events` /
> `signals_events` — the same tables Phase C will emit into. Any Phase C event
> must use a DISTINCT `event_type` to avoid colliding with #1-#3 producers.

---

## 5. PRIVACY RISKS

Grep of all emitted payloads (props_json whitelist + rawData):

| field | risk | evidence |
|---|---|---|
| `agent_feedback.comment` | **MEDIUM — free-text user input stored verbatim** | `app/api/agents/feedback/route.ts:78` writes raw `comment` into `signals_events.props_json`. Zod limits 280 chars (`d1-event-types.ts:219`) but does NOT strip PII. |
| `prompt_injection_detected.reasons` | LOW — pattern IDs only | `d1-event-types.ts:154` comment: "pattern IDs only — NO raw prompt". |
| `llm_call_trace` | LOW — no prompt text | schema (`d1-event-types.ts:173-187`) has provider/model/tokens/cost only. |
| `byok_call` / `byok_key_set` | NONE — key material excluded | `d1-event-types.ts:160-164` comment: "plaintext keys NEVER enter signals_events". |
| `api_rate_limit_hit.identifier` | LOW — hashed | `d1-event-types.ts:78` comment: "hashed IP / API key prefix — no raw values". |
| `local_mode_*` hostname | LOW — FNV-1a hashed | `d1-event-types.ts:99,111`. |

**Mitigation for `agent_feedback.comment`:** add a PII-scrub step (email/phone regex strip) before `track()` in `app/api/agents/feedback/route.ts:74`, OR truncate further + disallow emails/phones in Zod. **Do NOT fix production code here — only proposed.**

---

## 6. MISSING PRODUCT SIGNALS

Signals required to measure the 10 questions but absent today:

1. `mission_abandoned` — mission created, never started (answers "what NOT build").
2. `mission_solved` — structured tag linking mission → customer problem type.
3. `time_to_first_value` — timestamp delta mission_start → first usable artifact.
4. `creative_quality_score` — structured quality signal independent of revenue.
5. `memory_helped` — retrieval event with output-quality delta.
6. `approval_rejected` with reason enum (WRONG/LOW_QUALITY/NOT_MY_STYLE/TOO_EXPENSIVE/TOO_SLOW/TOO_COMPLEX/NOT_USEFUL/OTHER) — current `agent_approvals` has no reason.
7. `autonomy_failed` — autonomy-specific failure distinct from generic task fail.
8. `workflow_health` — start→terminal ratio over a time window.
9. `wizard_to_first_mission` — funnel event for "minimum lovable workflow".
10. `cost_to_asset_bridge` — attribution linking `graph_node_completed` cost to asset revenue.

---

## 7. DETERMINISM NOTE

`recordNodePerformance` (`production-graph-runner.ts:649-688`) is a **side-channel write** — it calls `recordPerformanceEvent` directly, NOT through `step.run`. The runner's deterministic checkpoint is `node_states_json` (written by `checkpoint()` at runner:591, read back for resume). The comment at `production-graph-runner.ts:450` confirms: "Deliberately NOT written into node_states_json / sentEvent payloads." Therefore `recordNodePerformance` does NOT affect the byte-identical checkpoint contract. **Phase C events emitted via `track()` (fire-and-forget, signals_events) are likewise outside the checkpoint.**

---

## 8. MIGRATION 0136 FIT CHECK

`0136_performance_feedback.sql` creates:
- `performance_feedback_cycles` (id, execution_id, sop_id, user_id, published_at, evaluate_at, status, metrics_json, evaluation_json, created_at).
- `prompt_optimization_log` (id, cycle_id, sop_id, step_index, original_prompt, suggested_prompt, improvement_score, applied, applied_at, created_t).

**Verdict: UNFIT for the 4 checkpoints + reason enum + useful YES/NO.**
- No `reason` column (need enum WRONG/LOW_QUALITY/...).
- No `useful` YES/NO column.
- No checkpoint-type discriminator (mission_complete / creative_approve+reject / significant_correction / abandonment).
- `prompt_optimization_log` stores raw prompts (`original_prompt`, `suggested_prompt`) — privacy-negative, not needed for feedback.
- Schema is SOP-centric (`sop_id`, `step_index`), not mission-centric.

**→ mig 0262 feedback budget PRESERVED. Do NOT reuse 0136; create a new mission-scoped feedback table.**

---

## 9. PHASE C REUSE VERDICT

| canonical event | reuse? | rationale |
|---|---|---|
| `performance_events` table | **MAY reuse** | existing `recordPerformanceEventIdempotent` writer + deterministic id pattern; emit new distinct `event_type` per checkpoint |
| `signals_events` via `track()` | **MAY reuse** | fire-and-forget, outside checkpoint; add new D1Events enum entries |
| `agent_approvals` | **MAY reuse** for approve/reject | but MUST add reason enum column (currently missing) |
| `production_graph_runs.node_states_json` | **MAY NOT reuse** for telemetry | deterministic checkpoint payload; never put telemetry here |
| `performance_feedback_cycles` (mig 0136) | **MAY NOT reuse** | unfit — wrong schema, no reason/useful, SOP-centric, stores raw prompts |
| `creative_missions.spent_cents` | **MAY NOT reuse** for feedback | ledger of spend, not a feedback signal |

---

PHASE A WRITTEN: /Users/macbook/sophia-ai-factory/docs/reality-loop/INSTRUMENTATION_AUDIT.md
