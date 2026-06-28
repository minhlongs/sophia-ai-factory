---
title: "Phase 02 — Tree: Mission Control UI"
description: "Upgrade /dashboard/missions into a CEO-style command center with NL mission input, agent team panel, and live SSE task feed."
status: completed
priority: P1
effort: 6h
branch: main
tags: [ui, missions, agents, sse, dashboard]
created: 2026-04-25
---

# Phase 02 — Tree: Mission Control UI

## Context Links
- Plan overview: `./plan.md`
- Existing page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/page.tsx`
- Existing dashboard: `src/components/raas/mission-dashboard.tsx`
- Mission launcher: `src/components/raas/mission-launcher.tsx`
- Missions API: `src/app/api/raas/missions/route.ts`
- Phase 01 dep: agents table in D1 + `src/lib/agents/` (agent runner, task queue)

## Overview
- **Priority:** P1 (blocked by Phase 01)
- **Status:** Pending
- **Description:** Replace generic "missions list + launcher modal" with a CEO-style **Mission Control** layout. User types a natural-language mission, system decomposes into subtasks, agents (CEO/Dev/QA/Ops/Marketing) execute, live feed streams progress via SSE.

## Key Insights
- Existing `MissionDashboard` already handles list/history — keep, do not rewrite.
- `MissionLauncher` modal is template-based; Mission Control adds a **NL input box** alongside it (does not replace).
- No SSE endpoint exists yet — must build `/api/agents/stream` (Phase 01 task queue feeds events).
- shadcn/ui components already include Card, Badge, Textarea, Button, Tabs — no new deps.
- Agents table from Phase 01 is the source of truth for the team panel (5 fixed roles per tenant).

## Requirements

### Functional
- FR1: NL mission input box (textarea) → POST `/api/raas/missions` with `{ prompt, mode: "nl" }`.
- FR2: Agent Team Panel shows 5 agents (CEO, Developer, QA, Ops, Marketing) with status badge (idle/working/blocked) + current task title.
- FR3: Task Feed streams events via SSE (`agent.task.started`, `agent.task.progress`, `agent.task.completed`, `agent.task.failed`).
- FR4: Quick Actions row: "New Mission" (focuses input), "Pause All" (POST `/api/agents/pause`), "View Logs" (links to `/dashboard/system-health`).
- FR5: Empty states when no agents provisioned (CTA: "Create AI Team").

### Non-Functional
- NFR1: Page initial render < 1.5s (LCP).
- NFR2: SSE auto-reconnect on drop (5s backoff, max 5 retries).
- NFR3: Mobile responsive (stack panels vertically < 768px).
- NFR4: i18n keys in `messages/en.json` + `messages/vi.json` under `dashboard.missions.control.*`.
- NFR5: Zero `:any` types, Zod validation on POST inputs.

## Architecture

```
/dashboard/missions (page.tsx)
├── MissionControlHeader        ← NL input + Quick Actions
├── grid (md:grid-cols-3)
│   ├── AgentTeamPanel (col 1)  ← Live agent status from /api/agents/list
│   └── TaskFeed (col 2-3)      ← SSE stream from /api/agents/stream
└── MissionDashboard            ← Existing: history + quick templates (kept as-is)
```

**Data flow:**
1. User types prompt → POST `/api/raas/missions` with `mode:"nl"` → backend decomposer (Phase 01) → enqueues subtasks
2. Agent runner picks tasks → emits SSE events to `/api/agents/stream`
3. `TaskFeed` (EventSource) appends events to scrollable list
4. `AgentTeamPanel` polls `/api/agents/list` every 5s OR subscribes to same SSE channel

## Related Code Files

### Create
- `src/components/missions/mission-control-header.tsx` (~80 lines) — NL textarea + submit + quick actions
- `src/components/missions/agent-team-panel.tsx` (~120 lines) — 5 agent cards w/ status badges
- `src/components/missions/task-feed.tsx` (~140 lines) — SSE stream consumer + scrollable feed
- `src/components/missions/agent-status-badge.tsx` (~40 lines) — Reusable badge (idle/working/blocked/error)
- `src/hooks/use-agent-stream.ts` (~80 lines) — EventSource hook w/ reconnect
- `src/app/api/agents/stream/route.ts` (~100 lines) — SSE endpoint (reads from Phase 01 task queue)
- `src/app/api/agents/list/route.ts` (~60 lines) — GET tenant's 5 agents w/ status
- `src/app/api/agents/pause/route.ts` (~50 lines) — POST pause all agents for tenant

### Modify
- `src/app/[locale]/dashboard/missions/page.tsx` — Add Mission Control sections above existing `MissionDashboard`
- `messages/en.json` + `messages/vi.json` — Add `dashboard.missions.control.*` keys
- `src/app/api/raas/missions/route.ts` — Accept `mode:"nl"` and route to Phase 01 decomposer

### Delete
- None (additive change, preserves all existing functionality)

## Implementation Steps

1. **i18n keys first** — Add `dashboard.missions.control.{title, subtitle, prompt_placeholder, submit, pause_all, view_logs, agent_team, task_feed, no_events, agent_idle, agent_working, agent_blocked, create_team_cta}` to en.json + vi.json.

2. **Build SSE endpoint** (`api/agents/stream/route.ts`):
   - Auth: `getCurrentUser()` from `@/lib/better-auth-session`
   - Return `Response` with `text/event-stream`, `Connection: keep-alive`
   - Read events from Phase 01 task queue (poll D1 `agent_events` table every 1s, scoped to `tenant_id`)
   - Heartbeat every 15s to keep connection alive on Cloudflare edge

3. **Build agent list endpoint** (`api/agents/list/route.ts`):
   - GET, auth-gated
   - Query D1 `agents` table where `tenant_id = currentUser.tenantId`
   - Return `{ agents: [{ id, role, status, currentTask?, lastActiveAt }] }`

4. **Build pause endpoint** (`api/agents/pause/route.ts`):
   - POST, auth-gated, Zod-validated empty body
   - Update `agents.status = 'paused'` for tenant
   - Emit `agent.paused` event to stream

5. **Build `useAgentStream` hook** — EventSource w/ auto-reconnect (5s, 5 retries). Returns `{ events: AgentEvent[], connected: boolean }`.

6. **Build `AgentStatusBadge`** — Shadcn Badge variants: `idle` (secondary), `working` (default + pulse), `blocked` (warning yellow), `error` (destructive).

7. **Build `AgentTeamPanel`** — 5 agent cards in 1×5 (mobile) or 1 col (md). Each card: role icon + name + status badge + current task line. Empty state w/ "Create AI Team" CTA.

8. **Build `TaskFeed`** — Scrollable list (max-h-96), newest events on top, auto-scroll only when at bottom. Each row: timestamp + agent role badge + event type + message.

9. **Build `MissionControlHeader`** — Card w/ heading, Textarea (autogrow, 4 rows max), Submit button, Quick Actions toolbar (New Mission focuses input, Pause All calls API, View Logs links).

10. **Wire into page** — Modify `page.tsx`: render `MissionControlHeader`, then 2-col grid with `AgentTeamPanel` + `TaskFeed`, then existing `MissionDashboard` below. Keep `MissionLauncher` modal for template-based launches.

11. **Modify `api/raas/missions/route.ts`** — Add Zod branch for `mode:"nl"`: forward `prompt` to Phase 01 decomposer, return `mission_id` + initial subtask count.

12. **Compile + smoke test** — `npm run build` (0 errors), `npm run dev`, manually verify SSE connects + events render.

## Todo List
- [x] Add i18n keys (en.json, vi.json)
- [x] Create `api/agents/stream/route.ts` (SSE)
- [x] Create `api/agents/list/route.ts`
- [x] Create `api/agents/pause/route.ts`
- [x] Create `hooks/use-agent-stream.ts`
- [x] Create `components/missions/agent-status-badge.tsx`
- [x] Create `components/missions/agent-team-panel.tsx`
- [x] Create `components/missions/task-feed.tsx`
- [x] Create `components/missions/mission-control-header.tsx`
- [x] Modify `dashboard/missions/page.tsx` to compose new components
- [x] Modify `api/raas/missions/route.ts` to accept `mode:"nl"`
- [x] Run `npm run build` → 0 errors
- [x] Run `npm test` → all pass
- [ ] Manual smoke test: submit NL mission, observe agent badges + feed

## Success Criteria
- `npm run build` exits 0, `npm test` 100% pass.
- Loading `/dashboard/missions` shows: Mission Control header (with NL input) + Agent Team Panel (5 agents) + Task Feed (SSE-connected) + existing dashboard below.
- Submitting NL prompt creates mission, agents transition idle→working, events appear in feed within 2s.
- "Pause All" button transitions all agents to `paused` state.
- Mobile (375px wide) stacks panels vertically without horizontal scroll.
- Zero `:any` types, Zod validation on all POST inputs, no `console.log`.

## Risk Assessment
- **R1: SSE on Cloudflare Workers edge** — Workers have 30s subrequest limits. Mitigation: heartbeat every 15s + client-side reconnect. Fallback: 3s polling if SSE fails 5 retries.
- **R2: Phase 01 decomposer not ready** — Mission Control submits to backend but no agents to consume. Mitigation: gate Phase 02 PR merge until Phase 01 agent runner exists in `src/lib/agents/`.
- **R3: TaskFeed memory leak** — unbounded event array. Mitigation: cap at last 200 events, drop oldest.
- **R4: i18n key drift** — Vietnamese/English keys out of sync. Mitigation: grep both files for `dashboard.missions.control` after edits, count must match.

## Security Considerations
- All endpoints (`stream`, `list`, `pause`) require `getCurrentUser()` — return 401 if no session.
- Tenant isolation: all D1 queries filter by `tenant_id = currentUser.tenantId`. No cross-tenant event leak via SSE.
- NL prompt input: server-side length cap (2000 chars) + Zod validation. Decomposer (Phase 01) handles prompt sanitization for downstream LLM call.
- SSE endpoint: rate-limit 5 concurrent connections per user (reuse `raas-rate-limiter`).

## Next Steps
- **Depends on:** Phase 01 (agent table, task queue, runner, decomposer) — must merge first.
- **Unblocks:** Phase 03 (Feedback Loop reads same `agent_events` table for analytics).
- **Follow-up:** Phase 04 wires Sentry to capture SSE disconnect errors + agent failures.

## Unresolved Questions
- Q1: Should agents be auto-provisioned on first `/dashboard/missions` visit, or require explicit "Create AI Team" CTA? (Blueprint says "one-click onboarding" — leaning auto-provision but defer to Phase 01 decision.)
- Q2: SSE on Cloudflare Workers — confirmed working in production, or do we need Durable Objects for long-lived connections? (Test in Phase 01 spike.)
- Q3: Should "Pause All" be reversible via a "Resume All" button, or is resume implicit on next mission submit?
