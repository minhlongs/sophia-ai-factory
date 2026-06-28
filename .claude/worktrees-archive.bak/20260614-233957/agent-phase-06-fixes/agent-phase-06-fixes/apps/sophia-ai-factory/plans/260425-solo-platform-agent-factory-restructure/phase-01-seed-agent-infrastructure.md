---
title: "Phase 01: Seed — Agent Infrastructure"
description: "Core agent orchestration layer: D1 tables, runner, API routes, server actions for CEO+Developer MVP agents"
status: pending
priority: P1
effort: 6h
branch: main
tags: [agents, d1, mvp, raas, seed]
created: 2026-04-25
---

## Context Links

- Overview: `plans/260425-solo-platform-agent-factory-restructure/plan.md`
- Existing missions schema: `migrations/0001-init.sql` (lines reused as pattern)
- DB pattern: `src/lib/db/client.ts` (sync `createServerClient()`)
- Auth: `src/lib/better-auth-session.ts` (`getCurrentUser`)
- LLM: `src/lib/llm/` (OpenRouter integrated)
- Reference API: `src/app/api/raas/missions/route.ts`

## Overview

**Priority:** P1 (foundation — blocks Phase 02+)
**Status:** completed
**Goal:** Add agent orchestration layer so each org owns a small "AI Company" (CEO + Developer agents). Reuse `missions` queue pattern, add agent metadata tables.

## Key Insights

- Sophia already has D1 + `missions` queue + LLM client. Don't reinvent — extend.
- `missions` row already has `params`, `status`, `result`, `error_message`. Agent task = mission with `agent_id` linkage via new `agent_tasks` table.
- Cloudflare Workers free tier: NO long-running runner. Tasks executed inline within Server Action / route handler invocation (sync await OpenRouter, write result, return). Durable Objects deferred to Phase 02.
- Server Actions preferred over API routes for mutations (per `development-rules.md`).
- Tier enum stays uppercase (`BASIC | PREMIUM | ENTERPRISE | MASTER`).

## Requirements

**Functional**
- Org owner can create an `agent_team` (auto-seeded with 2 agents: CEO, Developer).
- User triggers a task targeting an agent → task queued → executed → result stored.
- Audit log of every agent invocation (input, output, tokens, cost, status).
- Status endpoint returns task state (queued/running/completed/failed).

**Non-functional**
- Zero `:any` types. All inputs Zod-validated.
- Build passes with 0 TS errors. All new tests pass.
- File size <200 lines per file (modularize as needed).
- Edge-safe: no Node-only APIs.

## Architecture

```
User → Server Action (createAgentTask)
        ↓
  D1: insert agent_tasks (status=queued)
        ↓
  Inline runAgent(taskId) [await OpenRouter via lib/llm]
        ↓
  D1: update agent_tasks (status=completed, result), insert agent_logs
        ↓
  Return task ID → client polls /api/agents/status/[id]
```

**Tables**
- `agent_teams` — one per org, stores team config JSON.
- `agents` — individual agent (role, system_prompt, model, team_id).
- `agent_tasks` — task queue (input, output, status, agent_id, org_id).
- `agent_logs` — append-only audit trail (task_id, action, payload_json).

## Related Code Files

**Create**
- `migrations/0016-agent-factory.sql` — schema (4 tables + indexes).
- `src/lib/agents/types.ts` — TS interfaces (AgentTeam, Agent, AgentTask, AgentLog).
- `src/lib/agents/repository.ts` — D1 CRUD (under 200 lines).
- `src/lib/agents/seed-default-team.ts` — auto-seed CEO + Developer on first call.
- `src/lib/agents/runner.ts` — `runAgent(taskId)` calls OpenRouter, writes result.
- `src/lib/agents/prompts.ts` — system prompts for CEO_Agent, Developer_Agent.
- `src/app/actions/agent-task.ts` — Server Action `createAgentTask(input)`.
- `src/app/api/agents/task/route.ts` — POST create task (alt to action, for external).
- `src/app/api/agents/status/[id]/route.ts` — GET task status.
- `src/lib/agents/repository.test.ts` — unit tests for CRUD.
- `src/lib/agents/runner.test.ts` — runner test with mocked OpenRouter.

**Modify**
- `src/lib/db/types.ts` — append agent table types.
- `docs/system-architecture.md` — add Agent Factory section.

**Delete**: none.

## D1 Migration (`migrations/0016-agent-factory.sql`)

```sql
CREATE TABLE IF NOT EXISTS agent_teams (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'My AI Company',
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  team_id TEXT NOT NULL REFERENCES agent_teams(id),
  role TEXT NOT NULL CHECK (role IN ('CEO','Developer')),
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'openai/gpt-4o-mini',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  input TEXT NOT NULL,
  output TEXT,
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed')),
  error_message TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_org_status ON agent_tasks(org_id, status);

CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  task_id TEXT NOT NULL REFERENCES agent_tasks(id),
  action TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_logs(task_id);
```

## TypeScript Interfaces (`src/lib/agents/types.ts`)

```ts
export type AgentRole = 'CEO' | 'Developer';
export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentTeam {
  id: string; orgId: string; name: string;
  config: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}
export interface Agent {
  id: string; teamId: string; role: AgentRole; name: string;
  systemPrompt: string; model: string; enabled: boolean; createdAt: string;
}
export interface AgentTask {
  id: string; orgId: string; agentId: string;
  input: string; output: string | null; status: AgentTaskStatus;
  errorMessage: string | null; tokensUsed: number; costUsd: number;
  createdAt: string; completedAt: string | null;
}
export interface AgentLog {
  id: string; taskId: string; action: string;
  payload: Record<string, unknown>; createdAt: string;
}
```

## Implementation Steps

1. Write `migrations/0016-agent-factory.sql` (schema above). Apply via `wrangler d1 migrations apply`.
2. Append agent rows to `src/lib/db/types.ts`.
3. Create `src/lib/agents/types.ts` (interfaces above).
4. Create `src/lib/agents/prompts.ts` — exports `CEO_PROMPT`, `DEVELOPER_PROMPT` constants.
5. Create `src/lib/agents/repository.ts` — `getOrCreateTeam(orgId)`, `listAgents(teamId)`, `createTask`, `getTask`, `updateTaskResult`, `appendLog`. Use `createServerClient()` sync.
6. Create `src/lib/agents/seed-default-team.ts` — idempotent, inserts CEO + Developer if missing.
7. Create `src/lib/agents/runner.ts` — `runAgent(taskId)`: load task+agent, call `lib/llm` OpenRouter, parse tokens, write result, append log. Wrap in try/catch → status=failed.
8. Create `src/app/actions/agent-task.ts` — Server Action: `getCurrentUser()` → seed team → create task → `await runAgent(id)` → return task.
9. Create `src/app/api/agents/task/route.ts` — POST: Zod validate `{ agentId, input }`, delegate to action.
10. Create `src/app/api/agents/status/[id]/route.ts` — GET: return task JSON, 404 if not owned by org.
11. Write tests: `repository.test.ts` (CRUD), `runner.test.ts` (mock OpenRouter, assert log written).
12. Run `npm run build` (0 errors) → `npm test` (all pass).
13. Update `docs/system-architecture.md` with Agent Factory section.

## Todo List

- [x] 0016 migration written + applied to D1 (local + remote)
- [x] `lib/agents/types.ts`
- [x] `lib/agents/prompts.ts`
- [x] `lib/agents/repository.ts` (<200 LOC)
- [x] `lib/agents/seed-default-team.ts`
- [x] `lib/agents/runner.ts`
- [x] Server Action `app/actions/agent-task.ts`
- [x] API `POST /api/agents/task`
- [x] API `GET /api/agents/status/[id]`
- [x] Unit tests (repository + runner)
- [x] `npm run build` → 0 TS errors
- [x] `npm test` → all pass
- [x] `docs/system-architecture.md` updated

## Success Criteria

- Migration 0016 deployed to D1 (verified via `wrangler d1 execute`).
- `POST /api/agents/task { agentId, input }` returns 200 with task ID; status reaches `completed` within request lifecycle.
- `GET /api/agents/status/[id]` returns task w/ output, tokens, cost.
- `agent_logs` has ≥1 row per task (action: `invoke`).
- Build green, all tests pass, zero `:any`.

## Risk Assessment

- **OpenRouter latency** — exceed Workers CPU limit (~30s). Mitigation: short prompts, `gpt-4o-mini`, fail fast on timeout.
- **Org isolation** — task accidentally exposed cross-org. Mitigation: every query filters `WHERE org_id = ?`; status route checks ownership.
- **Cost runaway** — user spams tasks. Mitigation: defer rate-limit to Phase 03 (note in plan.md); for MVP rely on existing `lib/quota` infra hooked optionally.

## Security Considerations

- Server Action validates session via `getCurrentUser()` → 401 if missing.
- API routes Zod-validate body; reject if `agentId` not in caller's org.
- `system_prompt` stored server-side only — never echoed to client.
- No secrets in repo — OpenRouter key already in env (`OPENROUTER_API_KEY`).

## Next Steps

- Phase 02: Durable Objects for stateful multi-turn agent sessions.
- Phase 03: Per-org rate limit + quota tier mapping for agent calls.
- Phase 04: Dashboard UI page `/dashboard/agents` (consumes APIs above).

## Unresolved Questions

- Should default model be `gpt-4o-mini` (cheap) or follow user's `BYOK` selection? Defaulting to `gpt-4o-mini`; revisit when BYOK integration prioritized.
- Per-org agent count cap — defer to Phase 03 quota work?
