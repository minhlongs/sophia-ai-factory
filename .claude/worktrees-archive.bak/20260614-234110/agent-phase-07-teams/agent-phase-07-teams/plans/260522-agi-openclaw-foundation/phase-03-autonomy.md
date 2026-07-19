# Phase 3: Autonomy — Implementation Plan

**Status:** IN PROGRESS
**Depends on:** Phase 2 (complete, deployed 8f118756)

---

## Tasks

### Task G: Confidence Scoring & Human Escalation
Track confidence per SOP step execution. Steps below threshold trigger escalation.
- CREATE: `src/seed/db/migrations/20260522_confidence_escalation.sql` — `sop_step_confidence` table + `escalation_requests` table
- CREATE: `migrations/0131_confidence_escalation.sql` — canonical copy
- CREATE: `src/seed/types/confidence.ts` — ConfidenceScore, EscalationRequest, EscalationStatus types
- CREATE: `src/tree/sop/confidence-scorer.ts` — scoreStepConfidence (heuristic: output length, error rate, latency ratio), shouldEscalate (threshold <0.8)
- CREATE: `src/seed/db/repositories/confidence-escalation-repo.ts` — logConfidence, createEscalation, resolveEscalation, getPendingEscalations
- Types: confidence (execution_id, step_index, score, factors_json, created_at), escalation (id, execution_id, step_index, reason, status, resolved_by, resolved_at, created_at)

### Task H: Outcome Tracking
Track SOP execution outcomes (views, CTR, revenue) linked to executions.
- CREATE: `src/seed/db/migrations/20260522_outcome_tracking.sql` — `sop_execution_outcomes` table
- CREATE: `migrations/0132_outcome_tracking.sql` — canonical copy
- CREATE: `src/seed/types/outcome.ts` — OutcomeMetric, OutcomeType enum, OutcomeSummary types
- CREATE: `src/seed/db/repositories/outcome-tracking-repo.ts` — recordOutcome, getExecutionOutcomes, getSOPOutcomeSummary, getCreatorOutcomeSummary
- Types: outcome (id, execution_id, sop_id, user_id, metric_type, metric_value, recorded_at, source)
- Metric types: video_views, click_through_rate, revenue_cents, engagement_rate, subscriber_gain

### Task I: Multi-Agent Execution Schema
Schema for multi-agent SOP runs (supervisor + workers). LangGraph integration deferred.
- CREATE: `src/seed/db/migrations/20260522_multi_agent.sql` — `agent_execution_sessions` + `agent_task_assignments` tables
- CREATE: `migrations/0133_multi_agent.sql` — canonical copy
- CREATE: `src/seed/types/multi-agent.ts` — AgentRole, AgentSession, AgentTaskAssignment, AgentStatus types
- CREATE: `src/tree/sop/multi-agent-coordinator.ts` — createSession, assignTask, completeTask, getSessionStatus (stub coordinator, LangGraph wiring deferred)

## Success Criteria
- tsc clean, npm run build passes, npm test passes
- 3 new D1 tables with indexes
- Confidence scorer compiles with heuristic scoring logic
- Outcome tracking supports 5+ metric types
- Multi-agent schema ready for future LangGraph integration
