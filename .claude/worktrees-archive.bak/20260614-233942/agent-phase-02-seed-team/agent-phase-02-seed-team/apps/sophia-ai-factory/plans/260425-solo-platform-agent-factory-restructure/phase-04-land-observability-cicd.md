---
title: "Phase 04 — Land: Observability + AI-Native CI/CD"
description: "Make agent execution observable and self-correcting via 5 enforcement gates."
status: completed
priority: P2
effort: 4h
branch: main
tags: [observability, agents, ci-cd, enforcement-gates, system-health]
created: 2026-04-25
---

# Phase 04 — Land: Observability + AI-Native CI/CD

## Context Links
- Plan overview: `./plan.md`
- Phase 01 (Seed): agent runner + D1 schema (depended on)
- Phase 02 (Tree): mission control UI
- Phase 03 (Forest): signals events emitted by runner (depended on)
- Existing system-health page: `src/app/[locale]/dashboard/system-health/page.tsx` (198 lines)
- Existing error tracker: `src/lib/telemetry/error-tracker.ts` — D1 `error_log` table, fingerprinting, Better Stack fallback
- Existing logger: `src/lib/utils/logger-utility.ts`
- Blueprint: 5 Enforcement Gates (Validation, Security, Quality, Dependency, Deployment)

## Overview
- **Priority**: P2
- **Status**: TODO
- **Brief**: Surface agent health metrics on existing system-health page, extend existing error tracker with `agent_role` context, write Vitest suite for runner with mocked LLM, and add a single pre-task enforcement gate (tier check). Reuse heavily — Sentry NOT introduced.

## Key Insights
- `error-tracker.ts` already writes to D1 `error_log` with fingerprint, PII scrub, Better Stack fallback. Just pass `agent_role` + `task_id` in `ErrorContext`.
- System-health page already uses React Query polling at 30s — add agent metrics card alongside services grid.
- `signals_events` table from Phase 03 is the source of truth for agent runtime metrics; no new metrics store needed.
- Sophia bans introducing Sentry mid-flight — `error_log` + Better Stack already cover error tracking.
- Tier guard utility exists: `src/lib/tier-guard.ts` — reuse for pre-task gate (no new permission system).

## Requirements

### Functional
1. System-health page shows new "AI Agent Health" section with: success rate (24h), p95 latency, error count by role, last failure timestamp.
2. Agent runner errors flow through existing `reportError()` with `{ agent_role, task_id, variant }` enrichment.
3. Vitest suite covers agent runner: success path, LLM timeout, schema-mismatch output, retry behavior — all with mocked LLM.
4. Pre-task enforcement gate: before runner starts, validate user tier permits agent execution; block with structured error if not.

### Non-Functional
- Health card refresh ≤ 30s (matches page cadence).
- Error reporting must NOT block agent runner (already async in `reportError`).
- Vitest LLM mock must be deterministic (no network).
- Pre-task gate must add < 5ms latency.

## Architecture

```
agent runner (Phase 01)
   │
   ├── ENFORCEMENT GATE: assertTierAllowsAgent(user, role)
   │       └── throws AgentTierBlockedError → mapped to 403
   │
   ├── try { llm() } catch (e) {
   │       reportError(e, { agent_role, task_id, variant, route: 'agent.runner' })
   │       track(AGENT_TASK_FAIL, …)              ◄── from Phase 03
   │       throw
   │   }
   │
   └── (success path: track(AGENT_TASK_COMPLETE, …))

system-health page
   │
   ├── existing /api/health  →  services grid (unchanged)
   └── NEW /api/health/agents →  AgentHealthCard
                                 SQL aggregates over signals_events
                                 + error_log JOINs
```

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/system-health/page.tsx` — add `<AgentHealthCard />` section under services grid
- `src/lib/agents/runner.ts` (Phase 01) — wrap LLM call with try/catch → `reportError(...)`; call `assertTierAllowsAgent()` first
- `src/lib/telemetry/error-tracker.ts` — extend `ErrorContext` interface with optional `agent_role?: string; task_id?: string; variant?: string` (additive, non-breaking)
- `docs/system-architecture.md` — add "Agent Observability" subsection
- `docs/project-changelog.md` — entry for Phase 04 ship

### Create
- `src/lib/agents/enforcement-gate.ts` — `assertTierAllowsAgent(user, role)` + `AgentTierBlockedError` class (under 80 lines)
- `src/lib/agents/agent-health-resolver.ts` — D1 SQL aggregator joining `signals_events` + `error_log` (under 120 lines)
- `src/app/api/health/agents/route.ts` — GET handler, RBAC, returns JSON (under 80 lines)
- `src/app/[locale]/dashboard/system-health/components/agent-health-card.tsx` — UI (under 150 lines)
- `src/lib/agents/runner.test.ts` — Vitest with mocked LLM (under 200 lines)
- `src/lib/agents/enforcement-gate.test.ts` — Vitest gate matrix (under 100 lines)

### Delete
- None.

## Implementation Steps

1. **Enforcement gate** — create `enforcement-gate.ts`: pure function `assertTierAllowsAgent(user, role)`; map roles → required tier (e.g., `developer→PREMIUM`, `marketing→PREMIUM`, `ceo→ENTERPRISE`). Source of truth: `@/config/tiers`. Throw `AgentTierBlockedError(role, requiredTier)`.
2. **Wire gate into runner** — first line of runner; on throw, return 403 from any caller route. Emit `track(AGENT_TASK_FAIL, { error_class: 'tier_blocked' })`.
3. **Extend `ErrorContext`** — add three optional string fields; no migration required (D1 `ctx_json` is JSON).
4. **Wrap runner LLM call** — try/catch; on error: `await reportError(err, { route: 'agent.runner', agent_role, task_id, variant })` then rethrow. Existing PII scrub + fingerprint reused.
5. **Health resolver** — SQL: 24h windows of (`event_type='agent_task_complete'` count) / (start count) per role for success rate; `MAX(ts) WHERE event_type='agent_task_fail'` for last failure; JOIN `error_log` on `json_extract(ctx_json,'$.agent_role')` for error class breakdown.
6. **API route** — `GET /api/health/agents`, RBAC via `getCurrentUser`, scope to user's `org_id` unless `role=admin`, Zod-validate query.
7. **Health card UI** — React Query polling 30s; mirrors existing service-card pattern (badges + latency); use Lucide `Bot` icon.
8. **Mount card** — append section to `system-health/page.tsx` under existing services grid.
9. **Vitest — runner** — mock LLM (vi.fn) returning success / throwing TimeoutError / returning malformed JSON; assert: success emits complete event, failure calls reportError, malformed triggers retry once then fails.
10. **Vitest — gate** — table-driven tests for every (role, tier) pair; assert correct throw / pass.
11. **Docs** — update `docs/system-architecture.md` with agent observability diagram (text); update `docs/project-changelog.md`.
12. **Compile + verify** — `npm run lint && npm test && npm run build` after each major group.

## Todo List
- [x] Create `enforcement-gate.ts` with role→tier map + error class
- [x] Wire gate into agent runner first line
- [x] Extend `ErrorContext` interface (additive fields)
- [x] Wrap runner LLM call with try/catch → `reportError`
- [x] Create `agent-health-resolver.ts` with windowed SQL
- [x] Create `GET /api/health/agents` route + Zod
- [x] Create `agent-health-card.tsx` (React Query 30s)
- [x] Mount card in `system-health/page.tsx`
- [x] Vitest: runner success / timeout / malformed / retry
- [x] Vitest: gate matrix per (role, tier)
- [x] Update `docs/system-architecture.md`
- [x] Update `docs/project-changelog.md`
- [x] `npm test && npm run build` → 0 errors
- [x] Verify production GREEN per Sophia rule

## Success Criteria
- `/dashboard/system-health` shows "AI Agent Health" card with live numbers within 30s of agent runs.
- Forced agent error (test endpoint) appears in `error_log` with `agent_role`, `task_id` in `ctx_json`.
- Gate blocks BASIC user from `developer` agent with structured 403 + `error_class='tier_blocked'` event.
- Vitest runner suite: 100% of new tests green; coverage of runner ≥ 80%.
- All new files under 200 lines (UI), 120 lines (resolver), 100 lines (gate).
- `npm run build` 0 TS errors; `npm test` all pass; CI/CD GREEN; production HTTP 200 (per Sophia Green Production Rule).

## Risk Assessment
- **D1 query latency** — JOIN of `signals_events` × `error_log` could be slow. Mitigation: index on `event_type, ts` exists; cap window to 24h; cache resolver result 30s in-memory.
- **Better Stack rate limit** — only fatal errors are pushed there (existing logic); agent volume routes via D1 — safe.
- **Test flakiness from real timers** — use `vi.useFakeTimers()` for retry tests.
- **Gate false-positive** — additive — admin/master always allowed; failsafe defaults to deny only when role explicitly mapped.
- **Phase 03 incomplete** — health resolver depends on Phase 03 events. Mitigation: build resolver tolerating zero rows (return zeroed metrics, no crash).

## Security Considerations
- Health API restricted to authenticated users; cross-org reads blocked unless `admin`.
- Error messages already PII-scrubbed (existing `scrubPIIDeep`).
- Tier gate is server-side only; never trust client-supplied role.
- No new secrets; reuses existing Better Stack token.
- Vitest mocks must NOT hit real LLM (cost + leak prevention) — assert via `vi.fn` call counts.

## Next Steps
- **Depends on**: Phase 01 (runner exists), Phase 03 (events emitted, `signals_events` populated)
- **Unblocks**: Future automated agent retry policies, billing-by-agent metrics, anomaly alerts
- **Follow-ups (out of scope)**: Other 4 enforcement gates (Security, Quality, Dependency, Deployment) → next iteration; Sentry adoption decision; auto-rollback of failing prompt variants

## Unresolved Questions
- Should `agent_role → required_tier` map live in `config/tiers/` or in `enforcement-gate.ts`? Defaulting to gate file; revisit if Phase 02 UI needs to read it.
- Acceptable error budget for agent failure rate before alerting? Need PM target (e.g., > 5% triggers ops alert).
- Does master-tier user bypass ALL gates or only some? Defaulting to bypass-all; confirm with product.
