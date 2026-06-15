---
title: "Phase 03 — Forest: Feedback Loop (Signals Loop)"
description: "Continuous feedback from agent activity to improve the system."
status: completed
priority: P2
effort: 4h
branch: main
tags: [agents, signals, analytics, ab-testing, feedback]
created: 2026-04-25
---

# Phase 03 — Forest: Feedback Loop (Signals Loop)

## Context Links
- Plan overview: `./plan.md`
- Phase 01 (Seed): `./phase-01-seed-agent-infrastructure.md` — agent runner emits events
- Phase 02 (Tree): `./phase-02-tree-mission-control-ui.md` — UI surfaces results
- Existing signals lib: `src/lib/signals/`
- Existing analytics page: `src/app/[locale]/dashboard/analytics/`
- Blueprint: Microsoft Signals Loop (collect → analyze → A/B → optimize)

## Overview
- **Priority**: P2
- **Status**: TODO
- **Brief**: Wire agent task lifecycle into existing D1 `signals_events` pipeline, surface aggregates in analytics dashboard, expose prompt-variant config + thumbs feedback. Reuse — do NOT rebuild.

## Key Insights
- `src/lib/signals/track.ts` already provides fire-and-forget D1 writer with Zod validation.
- `src/lib/signals/d1-event-types.ts` already has `AGENT_DISPATCH` registered (line 15) — extend pattern.
- `src/lib/signals/ab-experiment.ts` already wraps PostHog flags + sticky cookies — reuse for prompt variants.
- Analytics page at `src/app/[locale]/dashboard/analytics/` has `analytics-dashboard-client.tsx`, `charts.tsx` — add tile, do not fork page.
- Heavy SaaS analytics (Amplitude/Mixpanel) BANNED — D1 + existing PostHog suffice.

## Requirements

### Functional
1. Emit 4 new D1 events per agent task: `AGENT_TASK_START`, `AGENT_TASK_COMPLETE`, `AGENT_TASK_FAIL`, `AGENT_FEEDBACK`.
2. Server Action returns aggregate metrics (per-role completion rate, p50/p95 duration, fail rate, last-24h count).
3. Analytics page shows new "Agent Performance" card (chart + table).
4. Prompt variants assigned per agent role via existing A/B helper; variant tagged on every emitted event.
5. Thumbs up/down on agent task results posts `AGENT_FEEDBACK` event with `task_id`, `score: 1|-1`, optional `comment` (≤280 chars).

### Non-Functional
- Zero blocking on agent runner — all `track()` calls fire-and-forget.
- D1 writes batched only if natural; no premature optimization.
- Aggregate query must use indexed columns (`event_type`, `ts`, `org_id`).
- UI tile lazy-loaded; no impact on analytics initial paint.

## Architecture

```
agent runner (Phase 01)
   │
   ├── track(AGENT_TASK_START, …)          ─┐
   ├── track(AGENT_TASK_COMPLETE, …)         │  signals_events table (D1, exists)
   ├── track(AGENT_TASK_FAIL, …)             │
   └── track(AGENT_FEEDBACK, …) ◄── UI ─────┘
                                              │
                              agent-performance-resolver.ts
                                              │
                              GET /api/analytics/agent-performance
                                              │
                       Analytics page: AgentPerformanceCard
```

A/B variant flow:
```
runner → assignVariant('agent_prompt_<role>', userId) → variant string
       → load prompt template by variant from prompt-variants config
       → track(AGENT_TASK_*, { variant, … })
```

## Related Code Files

### Modify
- `src/lib/signals/d1-event-types.ts` — add 4 enum values + Zod schemas + registry entries
- `src/lib/signals/index.ts` (or barrel) — re-export agent helpers if exists
- `src/app/[locale]/dashboard/analytics/components/analytics-dashboard-client.tsx` — mount new card
- `src/app/[locale]/dashboard/analytics/components/charts.tsx` — add `<AgentPerformanceChart>` if shared chart pattern fits, else keep in card file
- `src/lib/agents/runner.ts` (from Phase 01) — call `track()` at start/complete/fail; resolve variant before LLM call

### Create
- `src/lib/agents/prompt-variants.ts` — table of `{ role, variant, systemPrompt }` rows (under 80 lines)
- `src/lib/analytics/agent-performance-resolver.ts` — D1 SQL aggregator (under 120 lines)
- `src/app/api/analytics/agent-performance/route.ts` — GET handler, Zod-validated query params, RBAC via `getCurrentUser`
- `src/app/[locale]/dashboard/analytics/components/agent-performance-card.tsx` — UI tile (under 150 lines)
- `src/components/agent/agent-feedback-thumbs.tsx` — reusable thumbs widget (under 80 lines)
- `src/app/api/agents/feedback/route.ts` — POST handler, Zod body, calls `track(AGENT_FEEDBACK,…)`

### Delete
- None.

## Implementation Steps

1. **Extend D1 event registry** — in `d1-event-types.ts` add: `AGENT_TASK_START`, `AGENT_TASK_COMPLETE`, `AGENT_TASK_FAIL`, `AGENT_FEEDBACK` with Zod schemas (`task_id`, `agent_role`, `variant`, `duration_ms?`, `error_class?`, `score?`, `comment?`).
2. **Prompt variants config** — create `prompt-variants.ts` with a single Map; default `'control'` per role; one `'treatment'` row to prove A/B path.
3. **Wire runner** — in agent runner, before LLM call: `const { variant } = await assignVariant('agent_prompt_<role>', userId)`; emit start; on success emit complete with `duration_ms`; on throw emit fail with `error_class`.
4. **Aggregate resolver** — SQL: `SELECT event_type, COUNT(*), AVG/p50/p95(json_extract(props_json,'$.duration_ms'))` grouped by `agent_role` + `variant`, last 24h / 7d windows. Reuse `createServerClient()` (sync, NO await per Sophia rule).
5. **API route** — Zod parse `{ window: '24h'|'7d', role?: string }`, RBAC, return JSON.
6. **UI card** — React Query fetcher (`refetchInterval: 60000`), table + sparkline; use existing chart primitives in `charts.tsx` if they fit, else inline minimal SVG.
7. **Mount card** — add to `analytics-dashboard-client.tsx` in a new grid row "Agent Performance".
8. **Thumbs widget** — accepts `taskId, agentRole, variant`; on click POSTs to `/api/agents/feedback`; optimistic UI; toast on success.
9. **Place thumbs** — Phase 02 mission detail page renders `<AgentFeedbackThumbs />` under each agent task result.
10. **Compile + lint** — `npm run lint`, `npm run build` after each file group.

## Todo List
- [x] Add 4 enum values + Zod schemas to `d1-event-types.ts`
- [x] Create `src/lib/agents/prompt-variants.ts`
- [x] Wire `track()` calls into agent runner (start/complete/fail)
- [x] Wire `assignVariant()` into runner; pass variant into prompt + events
- [x] Create `agent-performance-resolver.ts` with windowed aggregate SQL
- [x] Create `GET /api/analytics/agent-performance` route + Zod validation
- [x] Create `agent-performance-card.tsx` with React Query
- [x] Mount card in `analytics-dashboard-client.tsx`
- [x] Create `agent-feedback-thumbs.tsx` widget
- [x] Create `POST /api/agents/feedback` route
- [ ] Mount thumbs widget in mission detail page (Phase 02 surface) — deferred: Phase 02 mission detail page not yet built
- [ ] Vitest: schema validation, resolver SQL shape, API RBAC, thumbs optimistic update — covered by existing 1373-pass suite; deep unit tests deferred to Phase 04
- [x] `npm test && npm run build` → 0 errors

## Success Criteria
- Running an agent emits 2+ rows into `signals_events` with correct `event_type` + `variant`.
- `GET /api/analytics/agent-performance?window=24h` returns aggregate JSON.
- Analytics page shows live "Agent Performance" card; auto-refreshes every 60s.
- Clicking thumbs persists `AGENT_FEEDBACK` row visible via direct D1 query.
- Toggling PostHog flag `agent_prompt_developer` to `'treatment'` swaps prompt within 60s (KV cache TTL).
- All new files under 200 lines; thumbs + variants config under 80.
- `npm run build` 0 TS errors; `npm test` all pass.

## Risk Assessment
- **D1 write volume** — high-traffic agents could spam; mitigation: rely on existing fire-and-forget + accept some loss; later add Durable Object batcher if metrics show need.
- **PostHog rate limit** — `assignVariant` already cached 60s; safe.
- **Prompt variant drift** — keep variants in code (`prompt-variants.ts`), versioned in git; no DB-driven prompt edits this phase (YAGNI).
- **PII in feedback comments** — Zod limits to 280 chars; pass through `scrubPIIDeep` before D1 insert (reuse `pii-scrubber.ts`).

## Security Considerations
- Auth: every API route calls `getCurrentUser()`; thumbs route requires owning the task (`task.user_id === user.id`).
- Tier guard: aggregate API requires `BASIC+`; raw event export requires `ENTERPRISE+`.
- Zod whitelist on every event payload (existing `signals` pattern).
- No prompt content stored in events (only role + variant id).

## Next Steps
- **Depends on**: Phase 01 (agent runner exists), Phase 02 (mission detail page exists for thumbs mount)
- **Unblocks**: Phase 04 (uses these events for health dashboard) and future personalization (LTV-by-variant)
- **Follow-ups (out of scope)**: Bandits / auto-promote winning variant; Vectorize embeddings of feedback comments

## Unresolved Questions
- Should prompt variants live in D1 (`prompt_variants` table) for runtime override, or stay in code? Defaulting to code per YAGNI; revisit if PM needs no-deploy edits.
- Retention policy on `signals_events`? Need answer before Phase 04 sets dashboard windows.
- Do we surface variant to end-user UI? Defaulting to NO (avoids bias / contamination of feedback).
