# PEV Engine Feasibility: Mekong → Sophia Port

**Date:** 2026-05-12  
**Target:** Assess viability of porting Mekong's Plan-Execute-Verify pattern to Sophia AI Factory  
**Conclusion:** **Port partially viable BUT NOT RECOMMENDED (YAGNI) — sophia's current mission/agent architecture already solves PEV problems without the complexity.**

---

## 1. Mekong PEV Anatomy

### Core 4 Files (LOC: 1,824 total)

| File | LOC | Role | Key Classes |
|---|---:|---|---|
| `src/core/planner.py` | 667 | Goal → task DAG | `RecipePlanner` (goal decomposition, LLM-based via `decompose_goal()`, fallback rule-based); `PlanningContext`, `VerificationCriteria` |
| `src/core/executor.py` | 445 | Task execution | `RecipeExecutor` (5 modes: shell, llm, api, tool, browse); retry logic (l.312-320); command sanitizer (l.302-310) |
| `src/core/verifier.py` | 482 | Result validation | `RecipeVerifier` (exit code, file exists/not-exists, output contains/not, custom checks via subprocess); `VerificationReport` (passed/failed/warnings summary); Binh Phap quality gates (l.424-473: TODO/FIXME, console.log, `:any` types) |
| `src/core/orchestrator.py` | 81 | Coord loop | `WorkflowOrchestrator` (simplified: load planner prompt, call LLM for plan, call LLM for exec — not real PEV loop; appears to be stub) |

### Dependencies

- **LLM:** `from src.core.llm_client import get_client()` — universal provider endpoint, fallback-chain (OpenRouter → Dashscope → DeepSeek → Anthropic → OpenAI → Google → Ollama)
- **State:** No persistent state layer — recipes exist in memory only (for recipes); execution history in logs (Rich console)
- **Error hierarchy:** `MekongError` base (not shown), `AgentTierBlockedError` referenced in sophia (l.60-61 of runner.ts)
- **Scheduling:** `DAGScheduler` (l.514) — validates DAG for circular deps, enables concurrent step execution

### Key Pattern: Replan on Failure

`planner.replan_failed_branch()` (l.540-624) — when step N fails, re-decomposes only failed branch + downstream deps, keeps successful steps. Enables recovery without full restart.

---

## 2. Sophia Mission/Agent Inventory

### Actual multi-step orchestration

| Path | Type | Multi-step? | Pattern |
|---|---|---|---|
| `forest/missions/dispatcher.ts` (178 LOC) | Mission router | ✅ YES — but hardcoded | Load mission → route to handler (23 cases hardcoded l.21-40) → update status/credits → fire webhook. **Single-pass only, no PEV loop.** |
| `forest/agents/runner.ts` (200+ LOC) | Agent executor | ❌ NO — one-shot | Load task → enforce tier gate → call OpenRouter once → write result (l.35-100 shown). **No multi-step decomposition.** |
| `forest/agents/repository.ts` | Task store | ✅ CRUD | D1-backed task CRUD (getTask, updateTaskStatus, etc.). Read-only inspection of schema. |
| `seed/ai/proposal-generator.ts` (210 LOC) | AI synthesis | ❌ NO — one-shot | Builds prompts → calls OpenRouter `/chat/completions` once → parses result sections (l.55-111, l.187-209). **Single fetch, no verification.** |
| `tree/telegram/handlers/missions-handler.ts` | Command dispatcher | ✅ Router | Routes @Sophia_Bbot commands (/campaign, /status, /results) to forest missions. **No retry/verify.** |

### Key difference from Mekong

- **Mekong:** Explicit PEV loop: plan → execute → verify → replan if failed
- **Sophia:** Event-driven imperative: receive mission command → dispatch to handler → fire-and-forget webhook. **No feedback loop.**

### Tier enforcement (forest/agents/enforcement-gate.ts)

Sophia has `assertTierAllowsAgent()` (l.59-79 in runner.ts) — gating agent roles by tier. Not part of Mekong's PEV; orthogonal concern.

---

## 3. Adaptation Map

| Mekong Concept | Sophia Equivalent | Effort | Notes |
|---|---|---|---|
| **Planner** (goal → task DAG) | `dispatcher.loadHandler()` routing | **M** | Sophia routes hardcoded 23 commands; Mekong uses LLM decomposition + DAG. To port: replace `switch(command)` with LLM decomposition + graph validation. Requires `forest/agents/decomposer.ts` (new). |
| **Executor** (multi-mode dispatch) | `runner.runAgent()` | **S** | Sophia runs one LLM call; Mekong runs shell/LLM/API/tool/browse. For PEV: extend runner to handle step.type. Minimal — just add a type discriminator. |
| **Verifier** (checks + gates) | None (missing!) | **M** | Sophia has NO post-execution validation. Would need `forest/agents/verifier.ts` (new) — implement VerificationCriteria checks (exit code, file exists, output patterns). |
| **Orchestrator** (PEV loop + retry) | None (missing!) | **L** | No feedback loop in Sophia. Would need `forest/agents/orchestrator.ts` (new) — plan → execute → verify → replan-on-fail loop. ~300 LOC. |
| **State store** (execution history) | D1 `agent_tasks` table (partial) | **S** | Sophia has task.status, task.result; Mekong uses in-memory Recipe + logs. D1 schema already exists; extend with `attempt_count`, `last_error`, `verification_report` columns. |
| **Error hierarchy** | No base exception class | **S** | Create `forest/agents/errors.ts` with `AgentExecutionError extends Error`, `VerificationFailedError`, `TierBlockedError` (reuse existing). |
| **DAG validation** | No DAG support | **M** | Implement `validateDAG()` (check circular, forward refs). ~100 LOC. |
| **Python → TypeScript** | Full rewrite | **L** | 1,824 LOC Python → ~2,500 LOC TypeScript (type annotations, async/await). |

### Runtime constraints (Cloudflare Workers)

| Mekong capability | Sophia edge runtime | Feasibility |
|---|---|---|
| Subprocess execution (`shell` mode) | ❌ NO — edge functions cannot spawn processes | Workaround: drop shell mode, route to async handler via Inngest |
| File I/O (`file_exists`, `file_not_exists` checks) | ❌ NO — no filesystem | Workaround: check D1 tables instead, or S3 via R2 |
| Long-running loops (retry, replan) | ❌ LIMITED — Workers timeout ~30s | Workaround: use Inngest for long-running PEV loops (deferred to forest/inngest) |
| In-memory Recipe state | ✅ OK — request scoped | Sophia already uses task rows in D1; port seamlessly |

**Edge compatibility score: 60%** — Core PEV logic (plan/execute/verify) works; subprocess/file checks require adapters.

---

## 4. YAGNI Verdict: **Defer Port**

### Does Sophia actually NEED PEV today?

#### Current mission/agent flows

1. **Proposal generator:** Goal = "create proposal from client info" → one LLM call → parse sections → done. ✅ Works, **no multi-step needed.**
2. **Video pipeline:** Goal = "generate video" → Remotion async handler (delegated to Workers via Inngest). ✅ Works, **single mission = one outcome.**
3. **Lead enrichment:** Goal = "enrich lead with company data" → fetch API → parse → store. ✅ Works, **linear, no retries.**
4. **Email campaign:** Goal = "send 100 emails" → batch loop in handler. ✅ Works, **imperative, no decomposition.**

#### Missing scenarios (where PEV would help)

- ❌ **Complex proposal workflows:** "Create proposal → send to client → wait for feedback → iterate" — currently hardcoded in handler logic, no generalized loop
- ❌ **Retry-on-failure for flaky APIs:** Mekong's retry + replan helps; Sophia falls back to mission `failed` status, manual retry
- ❌ **Quality gates:** Sophia has NO post-LLM validation (e.g., "proposal must include pricing section"). Mekong's Binh Phap checks catch this

#### Cost of porting now vs deferring

| Scenario | Now | Later |
|---|---|---|
| **Scope bloat** | Add 2-3 new files (decomposer, verifier, orchestrator), 800+ LOC, test coverage. Increases mental model complexity. | Wait until 2-3 use cases demand multi-step logic, then extract pattern. |
| **Time to market** | 2-3 days research + implementation. Slows current roadmap. | 0 days now, 3 days when needed. |
| **Risk** | Untested integration with D1/Inngest. May have edge case bugs (DAG cycles, timeout handling). | Risk remains same; pattern proven in Mekong so implementation is straightforward. |
| **Benefit delivered** | 0 new features for users. Cleaner internal API for future multi-step missions. | Same future benefit, but only after first real multi-step use case. |

**Verdict:** YAGNI — port DEFERRED. Today's missions do NOT need PEV.

---

## 5. Recommended Scope (If Porting Later)

If sophia gains complex workflows (e.g., proposal iteration, multi-step lead nurture), port this **minimal stack**:

### Phase 1: Verifier only (immediate need)

```
forest/agents/verifier.ts
├── VerificationCriteria (Zod-validated config)
├── VerificationCheck result type
└── verify(executionResult, criteria) → VerificationReport
```

**Why first:** Enables quality gates (e.g., "proposal lacks pricing" → fail). Works standalone, no orchestrator needed. ~200 LOC.

### Phase 2: Planner (when workflows demand it)

```
forest/agents/decomposer.ts
├── LLM-based goal → task list
├── validateDAG() for circular deps
└── RecipePlanner.plan(goal) → Recipe with step.dependencies
```

~300 LOC. Depends on forest/agents/verifier.ts for criteria generation.

### Phase 3: Orchestrator (if long-running needed)

```
forest/inngest/functions/pev-orchestrator.ts
├── planStep, executeStep, verifyStep as separate Inngest tasks
├── replan_failed_branch() retry logic
└── Max attempts = 3 (then escalate)
```

~250 LOC, integrated with existing Inngest setup.

### What NOT to port

- ❌ `shell` executor mode (not compatible with Workers)
- ❌ In-memory Recipe objects (use D1 `plan_execution` table instead)
- ❌ `tool_registry` / `browser_agent` (not applicable to sophia's domain)

**Total port cost if deferred to Phase 1+2+3:** ~700 LOC TypeScript, testable in parallel with other features.

---

## 6. Unresolved Questions

1. **D1 schema for PEV:** Should `engine_missions.execution_history` be a JSONB array of ExecutionResult objects, or separate `execution_attempts` table? (Affects Verifier design.)
2. **Inngest integration:** If replan triggers new steps, do they become new Inngest jobs or resume same job with `ctx.sleepUntil()`? (Affects orchestrator design.)
3. **User-facing rollback:** If PEV replans failed step, should user see original + replanned attempts in UI, or only final outcome? (Affects data retention policy.)

---

**Report complete. No implementation files created per research-only mandate.**
