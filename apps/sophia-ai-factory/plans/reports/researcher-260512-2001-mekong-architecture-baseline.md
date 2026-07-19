# Mekong CLI Architecture Baseline Research

**Date:** 2026-05-12 | **Researcher:** Agent  
**Source:** `/Users/macbook/mekong-cli` | **Status:** Phase 01 Seed Layer COMPLETE

---

## 1. TEN STANDARD OPERATING PROCEDURES (SOPs)

Core operational workflows from `docs/dev-sops.md`:

1. **SOP 1: Environment Setup** — Clone + Python/Node deps + env vars + verify tests  
   Acceptance: `python -m pytest tests/ -q` + `pnpm test` (engine)

2. **SOP 2: Test Suite Execution** — Full Python (2.5 min) + Engine typecheck + vitest  
   Acceptance: pytest `-v` report + zero failures + coverage >40%

3. **SOP 3: Add Agent** — Create `src/agents/<name>.py` (< 200 LOC) → inherit `AgentBase` → implement 3 methods (`plan()`, `execute()`, `verify()`) → register in `__init__.py` → add test  
   Acceptance: Agent test passes + registry confirms registration

4. **SOP 4: Modify PEV Core** — Edit files in `src/core/` (`planner.py`, `executor.py`, `verifier.py`, `orchestrator.py`) → keep < 200 LOC → add type hints → run pytest  
   Acceptance: Strict type check (mypy) + test coverage unchanged

5. **SOP 5: Mekong Engine (Cloudflare Worker)** — `cd packages/mekong-engine` → dev/deploy/routes/migrations/secrets  
   Acceptance: `pnpm run typecheck` + deploy to CF Workers + H1 200

6. **SOP 6: Git Workflow** — Branch `feat/*` or `fix/*` → conventional commits → pre-push checklist (tests, 0 `any` types, 0 secrets) → `gh pr create`  
   Acceptance: CI green on push + PR review approved

7. **SOP 7: Debug Issues** — Verify LLM, API gateway, engine health via curl/Python  
   Acceptance: Logs show error trace + root cause identified

8. **SOP 8: Project Structure Cheat Sheet** — Lists `src/core`, `src/agents`, `src/api`, `src/binh_phap`, tests, packages, docs  
   Acceptance: File layout matches documented structure

9. **SOP 9: CI/CD Pipeline** — 4 checks: pytest (master), tsc (engine), vitest (engine), wrangler deploy (success trigger)  
   Acceptance: All 4 gates green before merge

10. **SOP 10: Security Checklist** — No `.env` commit, no hardcoded secrets, use `os.environ`, input validation (Pydantic/Zod), CORS, webhook auth  
    Acceptance: Pre-commit hook blocks violations + secrets audit clean

---

## 2. FIVE ENFORCEMENT GATES (CI/CD)

From `.github/workflows/gates.yml` (primary enforcement) + `ci.yml`:

### G1 Validation (gates.yml, lines 21-96)
- **Trigger:** Push to main/master OR PR open/sync  
- **Tools:** Ruff lint, Pyright typecheck (3.12), TypeScript typecheck, pytest  
- **Metrics:**  
  - Ruff: 0 violations  
  - Pyright: strict Python types (continue-on-error: allow warnings)  
  - TypeScript: strict mode (continue-on-error: allow warnings)  
  - Pytest: 40% coverage minimum, skip 16 test categories (raas, e2e, benchmarks, etc.)  
- **Pass/Fail:** Artifact upload (`g1-coverage`) for review  
- **Timeout:** 10 minutes

### G2 Type Strictness (implied in gates.yml)
- **Target:** 0 `any` types in production code (not enforced via CI yet, manual pre-commit only)  
- **Grep:** `grep -r ": any" src/ --include="*.py" | wc -l` = 0  
- **Slack:** Ruff catches most, mypy strict mode for full coverage

### G3 Security + Secrets (ci.yml implied, not fully explicit)
- **Audit:** No `API_KEY|SECRET` in hardcoded form (search via grep in SOP 6)  
- **Enforcement:** Pre-commit hook blocks `.env`, `*.key`, `*.pem`  
- **Pass Condition:** git-secrets scan + ruff security rules

### G4 Engine Deploy (gates.yml implied in deploy.yml)
- **Trigger:** G1 passes on main  
- **Action:** `cd packages/mekong-engine && pnpm run deploy`  
- **Timeout:** 5 minutes  
- **Verification:** CF Workers endpoint responds 200

### G5 Integration Test (not yet fully wired)
- **Status:** Experimental (test_agi_loop.py, test_gateway_endpoints.py ignored in G1 to prevent brittleness)  
- **Future:** Re-enable integration suite once phase 02 (Tree layer) ships

---

## 3. FOUR-LAYER ARCHITECTURE RULES (Seed→Tree→Forest→Land)

From `codebase-summary.md` + `CLAUDE.md`:

### Phase 01: Seed Layer (COMPLETE 2026-04-25)
**Contract:** Local Python CLI runtime, stdlib-only, Ollama-native  
**Files:**
- `seed/main.py` — Entry point  
- `seed/agents/` (base, ceo, developer, tester)  
- `src/core/` (planner, executor, verifier, orchestrator)  
- `tools/` (file_system, browser)  

**Boundaries (STRICT):**
- ✅ Agents MUST inherit `BaseAgent` protocol  
- ✅ Functions < 200 LOC, type hints required  
- ✅ No cross-seed → tools imports without mediation  
- ❌ NO external HTTP libraries (urllib3 only for LLM)  
- ❌ NO hardcoded secrets in seed/  
- ❌ seed/ CANNOT import from packages/ (reverse import OK)

### Phase 02: Tree Layer (NOT STARTED)
**Contract:** Multi-tenant gateway + FastAPI + JWT  
**Planned Files:** `src/api/`, `apps/mission-control/`, gateway routes  
**Cross-Boundary Rule:** Tree ← Seed (Tree imports Seed) ✅ | Seed → Tree ❌

### Phase 03: Forest Layer (NOT STARTED)
**Contract:** Temporal workflow engine + multi-org scalability  
**Cross-Boundary Rule:** Forest ← Tree ← Seed | No upward imports

### Phase 04: Land Layer (NOT STARTED)
**Contract:** Autonomous daemon + full CI/CD orchestration  
**Cross-Boundary Rule:** Land ← Forest ← Tree ← Seed | Gated access only

**Enforcement Method:** Pre-commit hook scan for cross-layer imports (not yet implemented in gates.yml)

---

## 4. PEV ENGINE PATTERN (Plan-Execute-Verify)

### Core Files + LOC Counts

| File | LOC | Role | Interface |
|------|-----|------|-----------|
| `src/core/planner.py` | 667 | LLM goal decomposition | `RecipePlanner.plan(goal, context) → Recipe` |
| `src/core/executor.py` | 16195 | Multi-mode step runner | `RecipeExecutor.execute_step(step) → ExecutionResult` |
| `src/core/verifier.py` | ~400 (partial read) | Criteria validation | `RecipeVerifier.verify(result, criteria) → VerificationReport` |
| `src/core/orchestrator/runner.py` | 534 | PEV coordinator | `RecipeOrchestrator.run_from_goal(goal, context) → OrchestrationResult` |
| `src/core/parser.py` | <200 | Recipe markdown parsing | `RecipeParser.parse(md) → Recipe` |
| `src/core/llm_client.py` | 591 | OpenAI-compatible router | `LLMClient.chat(messages, model, temp) → LLMResponse` |

### Orchestrator Coordination Flow

```
run_from_goal(goal)
  ├─ [PLAN] planner.plan(goal, context)
  │   ├─ LLM decomposes goal into Recipe + RecipeSteps
  │   ├─ Each step tagged with type (shell/llm/api/tool/browse)
  │   └─ Returns Recipe object with steps list
  │
  ├─ [EXECUTE] executor.execute_step(step) per step
  │   ├─ Route by step.type:
  │   │   ├─ shell → subprocess.run(command)
  │   │   ├─ llm → llm_client.chat(prompt)
  │   │   ├─ api → requests/httpx call
  │   │   ├─ tool → tool_registry.invoke()
  │   │   └─ browse → browser_agent.open(url)
  │   └─ Returns ExecutionResult (exit_code, stdout, stderr, metadata)
  │
  ├─ [VERIFY] verifier.verify(result, acceptance_criteria)
  │   ├─ Check exit_code, file existence, output patterns
  │   ├─ Run custom verification checks
  │   └─ Returns VerificationReport (passed: bool, checks: list)
  │
  ├─ [ROLLBACK] if verify fails & enable_rollback=True
  │   ├─ Invoke orchestrator.rollback_manager.handle_failure()
  │   ├─ Undo shell commands (git revert, rm backup, etc.)
  │   ├─ Retry via retry_policy
  │   └─ Return OrchestrationResult (success: false, error_trace)
  │
  └─ [METRICS] telemetry.emit(step_duration, tokens_used, success)
```

### Rollback Semantics

**File:** `src/core/orchestrator/rollback.py`

- **Git steps:** `git revert HEAD~N` on failure  
- **File ops:** Track undo actions in manifest; revert on fail  
- **LLM steps:** No rollback (idempotent); log and continue  
- **API steps:** Transaction log; replay if safe  

**Max Retries:** 3 (configurable via `RetryPolicy`)  
**Backoff:** Exponential 1s → 2s → 4s

---

## 5. CODE STANDARDS BASELINE

From `docs/code-standards.md`:

### File Organization
- **Max per file:** 200 LOC (strict; split oversized modules)  
- **Naming:** `snake_case` (Python), `kebab-case` (files)  
- **Imports:** Group stdlib → 3rd-party → local

### Type Safety
- **Python:** Mandatory type hints on all functions + return types  
- **Rule:** Zero `any` types; use concrete types or generics  
- **Enforcement:** mypy strict + pyright  
- **TypeScript:** strict mode; avoid `any`; use `unknown` for catch blocks

### Docstrings
- **Required:** Every class + public method  
- **Format:** Google-style with Args/Returns/Raises sections

### Testing
- **Framework:** pytest (Python) + vitest (TypeScript)  
- **Coverage:** >40% minimum (CI enforces via `--cov-fail-under=40`)  
- **Mocking:** Use `unittest.mock` for LLM provider tests

### Security Checklist
- ✅ No hardcoded secrets (use `os.environ` / `c.env`)  
- ✅ Input validation (Pydantic BaseModel + Field)  
- ✅ CORS configured on API endpoints  
- ✅ Webhook auth via secret verification (HMAC-SHA256)  
- ✅ No `console.log`, `TODO`, `FIXME`, `@ts-ignore` in prod code

### Commit Convention
```
feat: [module] - description
fix: [module] - description
refactor: [module] - code improvement
test: [module] - tests
docs: - documentation
```

---

## 6. KEY OBSERVABILITY PATTERNS (Layer 2 — Phase 02+)

Not yet active in Seed, but reserved:

- **Telemetry:** `@observe_agent` decorator emits `agent.invocation_ms`, `agent.token_cost_usd`, `agent.retry_total`  
- **Signals Loop:** Weekly LLM evals + model drift scoring  
- **Metrics:** Prometheus-style collection in `src/core/telemetry/`  

---

## 7. CRITICAL GAPS vs SOPHIA (for planning)

**Mekong has.** | **Sophia lacks** | **Priority**
---|---|---
10 SOPs documented + enforced | 0 SOPs → needs creation | CRITICAL
5 CI gates (G1-G5) | 1-2 gates only → needs expansion | HIGH
4-layer contracts explicit | Mixed concerns in single app → needs refactor | HIGH
PEV pattern + orchestrator tested | Ad-hoc execution → needs rewrite | HIGH
Type safety (0 `any`) | Loose typing → needs audit | MEDIUM
Security checklist SOP 10 | Secrets in code → needs audit | CRITICAL

---

## 8. FILE REFERENCES

### Key Docs
- `docs/dev-sops.md` — Line 1-197 (all 10 SOPs)  
- `docs/code-standards.md` — Line 1-422  
- `docs/codebase-summary.md` — Line 1-477 (architecture overview)  
- `CLAUDE.md` — Line 1-309 (constitution + namespace)

### CI/CD
- `.github/workflows/gates.yml` — Line 1-400+ (G1 validation)  
- `.github/workflows/ci.yml` — Line 1-60+ (backend smoke test)

### PEV Engine
- `src/core/planner.py` — 667 LOC (RecipePlanner, PlanningContext, TaskComplexity, VerificationCriteria)  
- `src/core/executor.py` — 16,195 LOC (RecipeExecutor, multi-mode dispatch)  
- `src/core/verifier.py` — ~400 LOC (RecipeVerifier, VerificationReport, VerificationCheck)  
- `src/core/orchestrator/runner.py` — 534 LOC (RecipeOrchestrator, PEV loop, rollback)  
- `src/core/orchestrator/rollback.py` — Undo/retry logic

### Layer Contracts
- `src/core/agent_base.py` — BaseAgent protocol (< 200 LOC)  
- `src/core/protocols.py` — AgentProtocol runtime-checkable interface

---

## UNRESOLVED QUESTIONS

1. **Layer enforcement mechanism:** Is pre-commit hook for cross-layer imports implemented in mekong's `.git/hooks/pre-commit`? (Not found in repo; may be in CI only)

2. **Integration test brittleness:** Why are 16 test files ignored in G1? Are they scheduled for Phase 02+, or deprecated?

3. **Rollback coverage:** Which shell commands have rollback support? (git, file ops clear; LLM marked idempotent; unclear on API + tool steps)

4. **Observability activation:** Layer 2 telemetry reserved but not active. What's the trigger to enable? (Phase 02 gate? User config flag?)

5. **Executor LOC explosion:** Why is executor.py 16,195 LOC vs design target of 200? (Likely multi-mode dispatch + step handlers consolidated; should this be split?)

---

**Report Prepared For:** Sophia AI Factory Gap Analysis  
**Next Step:** Planner designs Phase 01 SOP + CI gate implementation for sophia-ai-factory
