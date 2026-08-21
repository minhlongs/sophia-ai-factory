# T006 Agent Factory Productization Review

**Task:** P1 from TASKS/constitution-tasks.md
**Scope:** Agent factory architecture, Constitution alignment, Mekong duplication, no-tech doctrine
**Status:** Complete - read-only investigation, no source files modified
**Date:** 2026-08-20

---

## 1. Architecture Summary

Sophia AI Factory has **two parallel agent systems** operating at different layers:

### System A: Markdown-Based C-Level Agents (`.sophia-factory/`)

Invoked via `mekong --agent` CLI from the local machine. These are instructional markdown files defining roles, responsibilities, tool sandboxes, and journal patterns.

| Agent | Tools | Layer |
|-------|-------|-------|
| `ceo.md` | Skill (spawn), Read, Edit, Bash, Grep, Glob | Team lead |
| `cto.md` | Read, Edit, Bash, Grep, Glob | src/**, tests/**, .github/** |
| `cmo.md` | Read, Edit, Grep, Glob | src/app/**/marketing, messages, blog, docs |
| `cso.md` | Read, Edit, Grep, Glob | src/app/**/pricing, messages, docs/sales |
| `coo.md` | Read, Edit, Grep, Glob | cron descriptions, ops docs, journal |
| `orchestrator.md` | Skill (spawn) | Routes founder requests to C-Level |
| `mekong-cli.md` | All | Cross-repo bridge, state mutations |

Journal maintained via `scripts/agent-journal/append-entry.sh` with PII scrub. No persistent memory; no task logging to D1.

### System B: Runtime D1-Backed Agent Factory (`src/tree/agents/` + `src/forest/agents/`)

Runs in Cloudflare Workers. D1-backed CRUD for agents/tasks/logs. Provider abstraction via OpenRouter. SSE streaming for live task events.

**Roles defined in runtime code:** CEO, CTO, CSO, CMO, COO, Developer, QA, Ops, Marketing (9 total)

**Key runtime components:**

| Component | Location | Function |
|-----------|----------|----------|
| Agent Runner | `tree/agents/runner.ts` | Tier enforcement, A/B variants, prompt resolution, OpenRouter call, usage metering |
| CEO Executor | `tree/agents/ceo-executor.ts` | Intent detection, campaign/revenue data fetch |
| Repository | `tree/agents/repository.ts` | D1 CRUD: teams, agents, tasks, logs |
| Enforcement Gate | `tree/agents/enforcement-gate.ts` | Role-to-tier mapping, MASTER bypass |
| Prompt Variants | `tree/agents/prompt-variants.ts` | A/B test variants (CEO + Developer only) |
| Prompts | `tree/agents/prompts.ts` | 8 bilingual system prompts |
| Seed Team | `tree/agents/seed-default-team.ts` | Creates default 8-agent team per org |
| Agent Protocol | `tree/agent-protocol/agent-executor.ts` | Full lifecycle: autonomy gate, permission check, budget, provider call, provenance |
| Health Resolver | `tree/agents/agent-health-resolver.ts` | 24h rolling success/fail aggregates from D1 |
| Performance | `land/analytics/agent-performance-resolver.ts` | Per-role start/complete/fail/duration aggregates |
| Feedback API | `land/api/agents/feedback/route.ts` | POST thumbs up/down with comment |
| SSE Stream | `land/api/agents/stream/route.ts` | Live task events via EventSource |
| Task API | `land/api/agents/task/route.ts` | Submit agent tasks |
| List API | `land/api/agents/list/route.ts` | List agents with derived status |
| Client Hook | `forest/hooks/use-agent-stream.ts` | React hook for SSE events |
| SOP Runner | `forest/missions/sop-runner.ts` | Multi-step orchestration via engine_missions |
| Autonomy | `forest/autonomy/types.ts` | 5-level autonomy (0-4) with cost thresholds |

**Note:** `forest/agents/` also has its own `runner.ts`, `enforcement-gate.ts`, `types.ts`, and `agent-health-resolver.ts` -- separate implementations from `tree/agents/`.

---

## 2. Constitution Alignment (AGENTS.md vs Runtime)

### 2.1 Role Mapping

AGENTS.md defines 6 roles: CEO, CTO, CMO, CSO, COO, Mekong CLI.

Runtime code defines 9 roles: CEO, CTO, CSO, CMO, COO, Developer, QA, Ops, Marketing.

**Gap:** Developer, QA, Ops, Marketing are in runtime but not in AGENTS.md. Mekong CLI is in AGENTS.md but not in runtime roles.

### 2.2 DB CHECK Constraint vs Runtime

Migration `0016-agent-factory.sql`:
```sql
role TEXT NOT NULL CHECK (role IN ('CEO', 'Developer'))
```

Runtime `seed-default-team.ts` attempts to insert: CEO, CTO, CSO, CMO, COO, QA, Ops, Marketing.

**CRITICAL FINDING:** The DB CHECK constraint only allows CEO and Developer. CTO, CSO, CMO, COO, QA, Ops, Marketing inserts will fail silently (seed-default-team catches errors and skips).

### 2.3 Tier Enforcement Divergence

Two different enforcement gate implementations exist with **different tier mappings**:

| Role | `tree/agents/enforcement-gate.ts` | `forest/agents/enforcement-gate.ts` |
|------|-------------------------------------|---------------------------------------|
| CEO | PREMIUM | PREMIUM |
| CTO | ENTERPRISE | ENTERPRISE |
| CSO | ENTERPRISE | ENTERPRISE |
| CMO | ENTERPRISE | ENTERPRISE |
| COO | ENTERPRISE | ENTERPRISE |
| Developer | ENTERPRISE | **PREMIUM** |
| QA | (not mapped) | **BASIC** |
| Ops | (not mapped) | **BASIC** |
| Marketing | (not mapped) | **PREMIUM** |

**FINDING:** Developer tier requirement differs (ENTERPRISE in tree vs PREMIUM in forest). This means the same agent could be allowed or denied depending on which gate is called.

### 2.4 Task API Route Zod Constraint

`/api/agents/task` route uses Zod schema restricting role to `CEO | Developer` only. Other roles cannot be submitted via the API even if DB allowed them.

### 2.5 Prompt Variant Coverage

Only CEO and Developer have A/B prompt variants in `prompt-variants.ts`. All other roles use a single hardcoded prompt. This limits experimentation to 2 of 9 roles.

---

## 3. Mekong Duplication Risks

### 3.1 Separation Assessment

| Concern | `.sophia-factory/` (System A) | Runtime Factory (System B) |
|---------|-------------------------------|----------------------------|
| Execution environment | Local machine via `mekong --agent` | Cloudflare Workers via D1 |
| State storage | File system (markdown) | D1 (SQLite) |
| Prompt source | Markdown agent files | `prompts.ts` + DB `system_prompt` column |
| Provider | Claude (local CLI) | OpenRouter (API) |
| Orchestration | Orchestrator.md keyword routing | SOP runner + engine_missions |
| Memory/Journal | File-based journal + PII scrub | None (no persistent memory) |
| Task logging | Journal entries (markdown) | D1 `agent_logs` + `signals_events` |
| Feedback | None | POST /api/agents/feedback |
| Streaming | None | SSE via /api/agents/stream |

### 3.2 Overlap Analysis

**The orchestrator.md provides:** Keyword-based routing to C-Level agents, team mode spawning, PII scrub on journal entries.

**The runtime factory provides:** The same C-Level roles (CEO/CTO/CMO/CSO/COO) plus Developer/QA/Ops/Marketing, with D1-backed task tracking, A/B variants, streaming, feedback.

**DUPLICATION RISK: MEDIUM-HIGH.** Both systems implement C-Level agent routing with different prompt sources and execution environments. The runtime factory duplicates the routing logic that orchestrator.md already provides for the same roles.

### 3.3 Mekong CLI Agent as Bridge

`.sophia-factory/agents/mekong-cli.md` is the designated bridge between both systems. It can mutate state in both repos and orchestrate Mekong subagents. However, the runtime factory has no dependency on Mekong -- it runs independently in CF Workers.

**Risk:** If someone updates prompts in `.sophia-factory/agents/ceo.md`, the runtime factory's `CEO_PROMPT` in `prompts.ts` does not automatically update. The two prompt sources can drift.

### 3.4 Recommendation

The runtime factory should be the **single source of truth** for all agent execution in production. The `.sophia-factory/` markdown agents should serve as documentation/governance only, with prompts synced to `prompts.ts` as the authoritative source. The orchestrator.md routing should delegate to the runtime factory API rather than duplicating routing logic.

---

## 4. No-Tech Doctrine Compliance

### 4.1 Customer Self-Service (BYOK)

- **Platform agents (CEO/CTO/etc):** Use `OPENROUTER_API_KEY` from Cloudflare Worker env vars. This is **platform infrastructure** -- acceptable under no-tech doctrine since it's the platform's own key, not customer-managed.
- **Customer-facing chat (`agent-chat`):** Uses `OPENROUTER_API_KEY` from env. The chat is the platform's assistant, not a customer's custom agent. Acceptable.
- **Setup Wizard:** Customer enters their own API keys (OpenRouter, ElevenLabs, D-ID). BYOK pattern preserved.

**Verdict: COMPLIANT.** Platform agents use platform keys. Customer agents use BYOK.

### 4.2 Operator-Credentials Tension

- `CLAUDE.deploy.md` references GitHub Actions CI/CD polling and operator-level deployment steps. **This is stale** -- GitHub Actions was disabled per CF-direct doctrine (2026-05-03). Deploy is now `npm run deploy:full` from local.
- No operator-managed third-party cron registrations or observability tokens found in runtime code.

**FINDING:** CLAUDE.deploy.md should be updated to reflect CF-direct doctrine.

### 4.3 Journal PII Scrub

`.sophia-factory/orchestrator.md` includes a PII scrub pattern (keys, JWTs, emails). The `scripts/agent-journal/append-entry.sh` script implements this. However, the runtime factory's `agent_logs` table does **not** enforce PII scrub on log entries -- `appendLog()` stores raw content.

**FINDING:** Runtime agent logs may contain PII if agents produce it in their output. This should be addressed before production use.

---

## 5. Productization Gaps and Recommendations

### CRITICAL (Must Fix Before Production)

| # | Gap | Evidence | Recommendation |
|---|-----|----------|----------------|
| 1 | **DB CHECK constraint mismatch** | Migration `0016-agent-factory.sql`: `CHECK (role IN ('CEO', 'Developer'))`. `seed-default-team.ts` tries to insert 8 roles. | Create migration to expand CHECK constraint to all 9 roles, or use a separate lookup table. |
| 2 | **Dual enforcement gate maps** | `tree/agents/enforcement-gate.ts` vs `forest/agents/enforcement-gate.ts` have different tier mappings for Developer (ENTERPRISE vs PREMIUM). | Consolidate to single enforcement gate. Pick canonical tier mapping and delete the other. |
| 3 | **Task API Zod restriction** | `/api/agents/task` Zod schema only accepts `CEO | Developer`. | Expand role enum to match all valid roles. |

### HIGH (Should Fix Before Beta)

| # | Gap | Evidence | Recommendation |
|---|-----|----------|----------------|
| 4 | **Dual type/repository implementations** | `tree/agents/types.ts` and `forest/agents/types.ts` are near-identical. `tree/agents/repository.ts` and `forest/agents/` have separate D1 access patterns. | Consolidate to single implementation. `tree/` is the canonical location per layer architecture; `forest/` should import from `tree/`. |
| 5 | **Dual runner implementations** | `tree/agents/runner.ts` (uses `resilientChatCompletion`) vs `forest/agents/runner.ts` (direct `fetch()` to OpenRouter). | Consolidate. `tree/agents/runner.ts` uses the proper provider abstraction. `forest/agents/runner.ts` bypasses it. |
| 6 | **Stale CLAUDE.deploy.md** | References GitHub Actions CI/CD, which was disabled 2026-05-03. | Update to reflect CF-direct doctrine: `npm run deploy:full` + SHA verification. |
| 7 | **No persistent agent memory** | No D1 table or implementation for agent memory/journal in runtime. `.sophia-factory/` has file-based journal but runtime has none. | Implement `agent_memory` D1 table with TTL and scope (per-workspace, per-agent). |
| 8 | **PII scrub not enforced in runtime logs** | `appendLog()` in `tree/agents/repository.ts` stores raw content. No scrub pattern applied. | Add PII scrub utility (reuse orchestrator.md pattern) before log insertion. |

### MEDIUM (Improve Before GA)

| # | Gap | Evidence | Recommendation |
|---|-----|----------|----------------|
| 9 | **Prompt variant coverage limited** | Only CEO and Developer have A/B variants in `prompt-variants.ts`. | Add variants for CTO and CMO at minimum -- high-value roles for prompt optimization. |
| 10 | **Cost estimation is rough constant** | `runner.ts`: `COST_PER_TOKEN = 0.000001` (~$1/1M tokens). Not per-model pricing. | Use OpenRouter's model-specific pricing or provider registry's `ModelInfo.inputCostPer1kTokens`. |
| 11 | **No execution cost dashboard** | No UI or API exposing per-agent/per-workspace cost aggregation. `AgentResult.costCents` is computed but not surfaced. | Add `GET /api/agents/costs` endpoint aggregating from `signals_events` or `agent_tasks`. |
| 12 | **Prompt source drift risk** | `.sophia-factory/agents/*.md` prompts diverge from `tree/agents/prompts.ts`. | Document `prompts.ts` as single source of truth. Add sync check in CI or a test that validates parity. |
| 13 | **SOP runner limited to engine_missions** | `sop-runner.ts` dispatches steps as `engine_missions` polling. No direct agent-to-agent handoff. | Consider adding inter-agent message passing for complex multi-step workflows. |

### LOW (Backlog)

| # | Gap | Evidence | Recommendation |
|---|-----|----------|----------------|
| 14 | **No agent-to-agent communication** | Each agent runs in isolation. No mechanism for CTO to delegate to Developer within a single workflow. | Design inter-agent protocol (could leverage `agent-protocol/types.ts` AgentRunnerEvent stream). |
| 15 | **Health resolver uses different data sources** | `tree/agents/agent-health-resolver.ts` reads from `signals_events`. `forest/agents/agent-health-resolver.ts` reads from `agent_tasks` with role join. | Consolidate to single health resolver using canonical data source. |

---

## 6. Evidence Trail

All findings are backed by direct file reads:

- **DB CHECK constraint:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/migrations/0016-agent-factory.sql` line 12
- **Seed team trying 8 roles:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/seed-default-team.ts` lines 15-57
- **Tree enforcement gate:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/enforcement-gate.ts` lines 4-15
- **Forest enforcement gate:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/agents/enforcement-gate.ts` lines 4-16
- **Task API Zod constraint:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/agents/task/route.ts` (role enum limited to CEO|Developer)
- **Prompt variants (CEO+Developer only):** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/prompt-variants.ts` lines 11-30
- **Tree runner using resilientChatCompletion:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/runner.ts` lines 83-85
- **Forest runner using direct fetch:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/agents/runner.ts` lines 22, 101
- **No runtime memory tables:** No D1 migration for agent_memory found in `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/migrations/`
- **Stale CLAUDE.deploy.md:** `/Users/macbook/sophia-ai-factory/.sophia-factory/CLAUDE.deploy.md` references GitHub Actions
- **PII scrub in orchestrator only:** `/Users/macbook/sophia-ai-factory/.sophia-factory/orchestrator.md` (markdown-level instruction)
- **appendLog stores raw:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/repository.ts` appendLog function
- **Cost constant:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/agents/runner.ts` `COST_PER_TOKEN = 0.000001`

---

## 7. Unresolved Questions

1. **What is the intended relationship between `tree/agents/` and `forest/agents/`?** Both have runner, enforcement-gate, types, and health-resolver implementations. The layer architecture says tree is reusable domain logic and forest is application-level orchestration, but the current split appears to be parallel implementations rather than layered delegation.

2. **Should the runtime factory replace the markdown agents entirely?** The markdown agents serve as governance documentation. If the runtime factory becomes authoritative, should `.sophia-factory/agents/*.md` be demoted to "reference only" with a sync mechanism?

3. **Who owns prompt maintenance?** Currently prompts live in two places (markdown files and TypeScript constants). Without a sync mechanism, they will drift.

4. **Is the SOP runner (`forest/missions/sop-runner.ts`) intended to replace the orchestrator.md routing?** Both provide multi-step agent orchestration, but at different layers.
