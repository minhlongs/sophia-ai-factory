# OmniRoute Best Practices Mapping to Sophia AI Factory

> **Prepared by**: Kongming (advisory agent)
> **Date**: 2026-08-15
> **Status**: Research report (advisory-only, no project changes)

---

## Executive Summary

This report maps the top practices from the OmniRoute repository (github.com/diegosouzapw/OmniRoute) against Sophia AI Factory's current quality infrastructure, architecture, and developer workflow. The analysis spans six dimensions: parallel execution, file ownership, task separation, code quality, testing, and architecture.

**Core insight**: OmniRoute and Sophia invest in different parts of the quality chain. OmniRoute invests in *what the work must satisfy* -- machine-enforced, frozen-baseline ratchets that degrade gracefully when the model or human is careless. Sophia invests in *who does the work* -- 32+ specialized agent definitions, a kongming/suntzu planning pipeline, and C-level organizational roles. Neither approach is wrong, but Sophia's agent-heavy model has **no machine backstop** when agents or humans skip steps; OmniRoute's ratchets catch regressions even when nobody is paying attention.

**Top 5 quick wins** (each deliverable in under a day, no infrastructure change):

1. **Introduce `quality-baseline.json`** -- freeze current vitest coverage, eslint warnings (341), and TS error count (0) as one-directional baselines; port OmniRoute's `check-quality-ratchet.mjs` as a single portable node script callable from `npm run ci` and the pre-push hook.

2. **Introduce `file-size-baseline.json`** -- freeze the 263 files currently over 200 lines as existing violations; new files must not exceed 200 lines; frozen files may only shrink.

3. **Add forgotten-sibling-test detection** to `npm run ci` -- when a source file under `src/` changes, trace its import graph to verify sibling test files also changed; detects test-skipping (`it.skip`, `xdescribe`) on new lines.

4. **Consolidate rule files into a single SSoT** -- Sophia currently scatters rules across `CLAUDE.md` (443 lines across 2 files) plus 17 `.claude/rules/*.md` files; create one `AGENTS.md` at repo root that holds all project rules; reduce `CLAUDE.md` to assistant-specific deltas only, mirroring OmniRoute's 55-line thin-delta pattern.

5. **Add `arch-lint.ts`** -- port `check-layer-boundaries.sh` (grep-based, already 100% functional in the pre-push hook) into a TypeScript rule with JSON output so it can participate in the same baseline JSON as the quality ratchet; layer boundary violations become a frozen-count metric.

---

## 1. Premise Correction: The fullstack-developer Agent

**Important finding**: The user's task asked to study "the OmniRoute fullstack-developer agent definition." OmniRoute ships **zero agent definitions**. There is no `.claude/agents/` directory, no `AGENTS.md`-referenced agent files, and no `fullstack-developer.md` anywhere in the OmniRoute repo.

The `fullstack-developer.md` file that exists at `/Users/macbook/.claude/agents/fullstack-developer.md` is **Sophia's own local agent definition** (121 lines, model: sonnet, 8 behavioral checklist items, 5-phase execution process, file ownership rules, parallel execution safety). It is a strong agent definition -- but it is a Sophia artifact, not an OmniRoute one.

**OmniRoute's agent strategy** is the opposite of Sophia's: instead of many specialized agents, OmniRoute puts all rules into a single 712-line `AGENTS.md` file at the repo root, with thin per-assistant deltas (CLAUDE.md: 55 lines; GEMINI.md: 14 lines) and three co-located area `AGENTS.md` files. Quality is enforced by ~82 automated scripts, not by agent behavioral checklists.

**Implication for this report**: Section 2 analyzes Sophia's `fullstack-developer.md` as an existing strength. Sections 3-5 focus on the machine-enforcement infrastructure that OmniRoute has and Sophia lacks -- that is where the real best-practice transfer happens.

---

## 2. Sophia's fullstack-developer Agent Analysis

| Attribute | Detail |
|---|---|
| File | `/Users/macbook/.claude/agents/fullstack-developer.md` (121 lines) |
| Model | `sonnet` (via frontmatter) |
| Role | Senior Full-Stack Engineer executing precise implementation plans |
| Behavioral checklist | 8 items: verify plan ownership, validate test infra, compile-check after each file, parallel safety via `SendMessage` |
| Execution process | 5 phases: Phase Analysis, Pre-Implementation Validation, Implementation, Quality Assurance, Completion Report |
| File ownership rules | "NEVER modify files not listed in phase's File Ownership section"; "NEVER read/write files owned by other parallel phases"; "If file conflict detected, STOP and report immediately" |
| Parallel safety | Work independently; trust listed dependencies; well-defined interfaces only; report completion to unblock |
| Team mode | 7-step loop: `TaskList` -> `TaskUpdate` claim -> `TaskGet` -> ownership -> complete -> `SendMessage` -> approve `shutdown_request` |

**Strengths**:
- File ownership model prevents parallel-agent collisions -- OmniRoute has no equivalent agent-level protocol (it relies on worktree isolation at the git level instead).
- Clear separation of "what to do" (plan from planner agent) from "how to verify" (quality assurance phase).
- Team mode protocol is well-structured for orchestrated multi-agent workflows.

**Gaps relative to OmniRoute**:
- No machine verification that file ownership rules are actually respected; relies on agent self-discipline.
- No automated detection of when a parallel phase's files were touched by another agent.
- No "base-green" concept -- the agent does not verify the base branch is green before starting work.

---

## 3. Best Practices Catalog with Sophia Mapping

### 3.1 Single Source of Truth (SSoT) for Project Rules

**OmniRoute practice**: One `AGENTS.md` (712 lines) at repo root holds ALL rules: 23 hard rules, quality gates, code conventions, file placement, repo-root hygiene, repository map. Per-assistant files (CLAUDE.md, GEMINI.md) contain ONLY assistant-specific deltas and explicitly forbid re-adding project rules.

**Sophia current state**: Rules are scattered across:
- `/Users/macbook/sophia-ai-factory/CLAUDE.md` (175 lines)
- `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/CLAUDE.md` (268 lines)
- `apps/sophia-ai-factory/.claude/rules/*.md` (17 files, various sizes)
- `~/.claude/rules/*.md` (global user rules, 6+ files)

There is no `AGENTS.md` anywhere in the Sophia repo. Rules are duplicated across the root CLAUDE.md and app CLAUDE.md (canonical import paths, protected flows, quality gates, and deployment contract appear in both).

**Gap**: No single source of truth; rules can drift between locations; agents loaded from different directories see different rule sets.

**Recommendation**: Create one `AGENTS.md` at the repo root consolidating all project rules (architecture, conventions, testing, quality gates, deployment, protected flows). Reduce both CLAUDE.md files to thin assistant-specific deltas. When a rule changes, it changes in exactly one place.

**Priority**: HIGH -- foundational for all other practices.

---

### 3.2 Co-located Area AGENTS.md with Drift Detection

**OmniRoute practice**: Three co-located `AGENTS.md` files exist (root, `src/lib/db/`, `open-sse/services/`), each containing:
- Module table (Module | Tables/Scope | Responsibility)
- Live count commands (e.g., `ls src/lib/db/*.ts | wc -l` currently 95)
- "Adding a New X" recipe (numbered steps)
- Explicit Anti-Patterns list
- `npm run check:docs-counts` for automated drift detection

**Sophia current state**: No co-located area documentation. Layer architecture is documented in CLAUDE.md and `.claude/rules/sophia-layer-architecture.md`, but there are no per-layer files in `src/seed/`, `src/tree/`, `src/forest/`, or `src/land/` with module tables or anti-patterns. The only automated drift check is `check-layer-boundaries.sh` (grep-based, checks import directions).

**Gap**: When a developer or agent works inside `src/forest/`, there is no in-directory reference showing which modules belong to forest, what their responsibilities are, or what anti-patterns to avoid.

**Recommendation**: Create `src/seed/AGENTS.md`, `src/tree/AGENTS.md`, `src/forest/AGENTS.md`, `src/land/AGENTS.md` -- each with a module table, live file-count commands, "Adding a New Module" recipe, and anti-patterns list. Wire `wc -l` drift checks into the CI script.

**Priority**: MEDIUM -- improves developer/agent context but does not block regressions.

---

### 3.3 One-Directional Quality Ratchets with Frozen Baselines

**OmniRoute practice**: `scripts/quality/check-quality-ratchet.mjs` (153 lines, fully portable plain Node.js + JSON) implements:
- Frozen baseline per metric (value, direction: "up"/"down", per-metric eps, tightenSlack)
- `--update` flag to bank improvements into the baseline
- `--require-tighten` flag to force banking in the same PR
- Orphan-metric warnings (collected but not in baseline)
- Markdown summary table output
- Exit 1 on regression; exit 1 on tighten violation; exit 2 on missing file
- Metrics tracked: coverage, test count, bundle size, eslint warnings, etc. via `config/quality/quality-baseline.json` and `config/quality/quality-metrics.json` (16 baseline/allowlist JSON files)

**Sophia current state**: No baseline JSON, no ratchet script, no frozen metrics. Coverage thresholds exist in `vitest.config.ts` (lines: 60%, branches: 45% globally; dashboard: 5%/5%; critical domains: 75%/65%) but are static -- they never tighten automatically and do not fail if a metric regresses from a previously observed higher value. ESLint max-warnings is 341 (hardcoded in `ci:lint` script), but this is a cap, not a ratchet -- it can never improve.

**Gap**: Metrics can regress silently. If coverage drops from 62% to 58%, no gate catches it (threshold is 60%). If eslint warnings increase from 341 to 350, the gate blocks push, but the 341 never tightens downward. There is no mechanism to bank improvements.

**Recommendation**: Port `check-quality-ratchet.mjs` directly (the script has no external dependencies, no GitHub Actions imports, runs with plain `node`). Create `config/quality/quality-baseline.json` with current observed values. Wire into `npm run ci` and the pre-push hook (already has 8 gates, add one more). Set `--allow-missing` for local runs (coverage only fully available in CI) and strict mode in CI.

**Priority**: HIGH -- this is the single highest-value practice transfer.

---

### 3.4 File-Size Ratchet (God-Component Prevention)

**OmniRoute practice**: `scripts/check/check-file-size.mjs` enforces:
- Frozen files may only SHRINK (never grow)
- New files must not exceed a CAP
- `--update` ratchets the baseline down (and removes entries already under cap)
- Comment: "the next 12,760-line file is impossible, and the current 91 only improve"

**Sophia current state**: Development rules state "Keep individual code files under 200 lines" but there is no automated enforcement. Current state: **263 production files exceed 200 lines**. The top 10 range from 434 to 518 lines:
- `src/app/[locale]/ai-video/[niche]/page.tsx` -- 518 lines
- `src/seed/db/repositories/sop-repo.ts` -- 467 lines
- `src/forest/deploy-guard/approval-service.ts` -- 466 lines
- `src/forest/pipeline/checkpoint-service.ts` -- 465 lines
- `src/tree/memory/conversation-summarizer.ts` -- 460 lines
- Plus 258 more over 200 lines

**Gap**: The 200-line rule is aspirational only. No gate prevents new 500-line files. No gate prevents existing files from growing.

**Recommendation**: Create `config/quality/file-size-baseline.json` listing all 263 current files as frozen (may only shrink). New files must not exceed 200 lines. Port `check-file-size.mjs` (plain Node.js, no dependencies). Wire into `npm run ci`. This does NOT require refactoring the 263 files now -- it only prevents things from getting worse.

**Priority**: HIGH -- prevents the next god-component; does not require refactoring the existing ones.

---

### 3.5 Forgotten-Sibling-Test Detection

**OmniRoute practice**: `scripts/check/check-forgotten-sibling-tests.mjs`:
- Traces changed source modules through the static/dynamic import graph to sibling tests that should have changed
- Detects test-masking (`it.skip`, `xdescribe`, `test.todo`) on `+` diff lines
- Demands an issue/PR reference for any skipped test
- Uses `resolveImport` from `build-test-impact-map.mjs` to build the import graph

**Sophia current state**: 667 test files, approximately 7,414 test function calls. Pre-push hook runs `vitest run` (G3) but does not check whether tests were deleted/skipped alongside source changes. No import-graph-based test impact analysis exists.

**Gap**: A source file can be modified and its corresponding test deleted/skipped without any gate noticing.

**Recommendation**: Port the forgotten-sibling-tests concept. Start simpler than OmniRoute's full import-graph approach: for each file changed in the commit, check that a matching test file exists (same path under `__tests__/` or adjacent `*.test.ts`). Escalate to import-graph tracing in a second phase.

**Priority**: MEDIUM -- catches a real class of silent regressions.

---

### 3.6 Documentation Accuracy Doctrine

**OmniRoute practice**: "Documentation must describe verified behavior, not plausible behavior." Four rules:
1. `rg -n "name" src/ open-sse/ bin/` before documenting any API/endpoint/path/CLI/env var -- no source match, no doc
2. Measure mutable counts with `wc -l` instead of memory
3. Copy examples from working usage, prefer `path/to/file.ts:line` over invented signatures
4. Run `npm run check:docs-all` for `docs/` edits

**Sophia current state**: Documentation exists in `docs/` directory (code-standards.md, deployment-guide.md, testing.md, etc.) and in bilingual handover docs. No automated accuracy checks. CLAUDE.md itself contains mutable counts (e.g., "6744+ tests" in the root file, "844+ tests" in the global file -- already out of date; actual count is ~7,414 test calls across 667 files).

**Gap**: Documentation can drift from reality with no automated detection. The CLAUDE.md test count discrepancy (844 vs 6744 vs actual ~7,414) is an existing example.

**Recommendation**: Add a `check:docs-counts` script that validates stated counts in CLAUDE.md against actual `wc -l` / `find | wc -l` output. Add `rg` verification to the docs-manager agent's checklist. This is low-effort and high-value for maintaining trust in documentation.

**Priority**: MEDIUM -- improves documentation trustworthiness.

---

### 3.7 Repo-Root Hygiene with Allowlist

**OmniRoute practice**: Project root may ONLY contain enumerated config/dependency/documentation/CI files (exact filename whitelist). All tests in `tests/`, all scripts in `scripts/<subfolder>/`. Root `_*` paths are private, gitignored, and untracked via `git rm --cached`. `check:tracked-artifacts` gate fails on ANY tracked root path starting with `_`.

**Sophia current state**: No repo-root hygiene policy. Scripts directory has 99 files with inconsistent organization (some in subdirectories, many at root level). No allowlist. The `.baseline-async-d1-count` file exists at the app level.

**Gap**: Root directory clutter accumulates without detection. Scripts can be placed anywhere.

**Recommendation**: Define a root-level file allowlist. Move loose scripts into organized subdirectories under `scripts/`. Add a `check:repo-hygiene` gate. This is a lower priority than the quality ratchet but prevents gradual entropy.

**Priority**: LOW -- prevents entropy but not urgent.

---

### 3.8 Worktree Isolation with git stash Ban

**OmniRoute practice**: Mandatory `.claude/worktrees/` for all AI-assisted work. Specific rules:
- `git stash` is BANNED (recorded recurrence of stash incidents through subagents)
- The stash ban must be replicated verbatim in the prompt of every subagent that touches git
- Base-branch confirmation via `AskUserQuestion` before starting
- `cp -al` for hardlinking node_modules (space-efficient)
- Teardown rules for worktree cleanup

**Sophia current state**: No worktree isolation policy documented in any rules file. No git stash ban. The pre-push hook exists but does not verify worktree state.

**Gap**: Multiple parallel agent sessions can collide on the working tree. The `git stash` failure mode documented in OmniRoute (lost work from stash pop in subagents) could occur in Sophia's multi-agent orchestration.

**Recommendation**: Add worktree isolation rules to the orchestration protocol and the fullstack-developer agent's behavioral checklist. Add a git stash ban to any agent that touches git (measurable via a prompt-level instruction). This requires no new scripts, only documentation and agent prompt updates.

**Priority**: HIGH for parallel agent work; MEDIUM otherwise.

---

### 3.9 Base-Green PR Discipline

**OmniRoute practice**: PRs must not be born red. A PR opened on a red base must carry `base-red inherited: #<issue>` in its body. `/sweep-reds` skill drains accumulated red state.

**Sophia current state**: Pre-push hook runs 8 gates (G0-G7) that block push on failure. But there is no check that the base branch was green before branching. The `deploy-2-guard.yml` workflow exists but its specifics are not yet explored.

**Gap**: A developer can branch from a base with 341 eslint warnings, add a change that brings warnings to 340, and the push succeeds -- even though the base was already non-compliant.

**Recommendation**: Add a `check:base-green` step to the pre-push hook that compares current metrics against the baseline JSON (from practice 3.3). If the base is red, require the PR body to document inherited violations. This builds on the ratchet infrastructure from 3.3.

**Priority**: MEDIUM -- valuable once the ratchet (3.3) exists.

---

### 3.10 Parallel Execution with Strict File Ownership

**OmniRoute practice**: `AGENTS.md` defines parallel execution rules: work in isolated worktrees, never modify files owned by another branch, well-defined interfaces only, report completion to unblock dependents.

**Sophia current state**: Sophia's `fullstack-developer.md` has the strongest file ownership model of any agent -- "NEVER modify files not listed in phase's File Ownership section." The orchestration protocol defines sequential chaining and parallel execution patterns. But there is no machine enforcement of file ownership; it relies on agent self-discipline.

**Gap**: When multiple fullstack-developer agents run in parallel, file ownership violations are detected only if the agent self-reports (it should, per its behavioral checklist, but there is no independent verification).

**Recommendation**: Add a post-phase verification script that, given a list of files claimed by each parallel phase, checks the git diff to confirm no file was modified by more than one phase. This could be a simple `git diff --name-only` intersection check. Wire it into the suntzu verification step.

**Priority**: MEDIUM -- prevents a class of subtle merge conflicts.

---

### 3.11 Test Retry Policy

**OmniRoute practice**: Explicit and differentiated:
- Playwright: 1 retry with trace
- Vitest: NO global retry
- node:test: NO retry ever
- Rationale documented: retries mask flaky tests; better to fix the root cause

**Sophia current state**: Vitest is used with `--run` (no retry flags visible in package.json scripts). Playwright config is in `tests/e2e/playwright.config.ts`. No documented retry policy.

**Gap**: Retry policy is implicit (defaults) rather than explicit and documented. If someone adds `--retry` to vitest, no gate catches it.

**Recommendation**: Document the test retry policy explicitly in the SSoT AGENTS.md. Verify vitest config has no `retry` setting. Add a check to the CI script that asserts vitest is not run with retry flags.

**Priority**: LOW -- the current behavior is likely correct, but making it explicit prevents drift.

---

### 3.12 Nightly Advisory Testing

**OmniRoute practice**: Scheduled advisory workflows (not blocking, but report results):
- Property-based testing (fast-check with seeded repro)
- Resilience/chaos testing
- LLM security testing (promptfoo + garak)
- Schema fuzzing (schemathesis)
- Mutation testing
- Compatibility testing

**Sophia current state**: k6 load tests exist (`test:load:steady`, `test:load:spike`, `test:load:soak`, `test:load:stress`). Smoke tests exist (`test:smoke`). Contract tests exist. No property-based testing, no mutation testing, no chaos testing.

**Gap**: No non-blocking advisory tests that discover latent issues without blocking deployment.

**Recommendation**: Start with property-based testing (fast-check) for Zod schemas (Sophia already validates all API inputs with Zod). This is the lowest-effort advisory test to add and covers a class of edge cases that unit tests miss. Mutation testing can follow once the ratchet infrastructure is in place.

**Priority**: LOW-MEDIUM -- valuable but not urgent.

---

### 3.13 Circuit Breaker Pattern (Shared Strength)

**OmniRoute practice**: 3-Layer Resilience: Provider Circuit Breaker -> Connection Cooldown -> Model Lockout. Per-kind error classification (AUTH_FAILURE, RATE_LIMIT, SERVER_ERROR).

**Sophia current state**: Circuit breaker on all external HTTP calls is documented in CLAUDE.md quality gates. "Per-kind error classification: AUTH_FAILURE -> immediate open, RATE_LIMIT -> cooldown, SERVER_ERROR -> retry with backoff" is explicitly stated.

**Assessment**: Sophia already implements this practice. No gap.

---

## 4. Priority Recommendations

### Quick Wins (under 1 day each, no infrastructure change)

| # | Practice | Effort | Impact |
|---|---|---|---|
| 1 | Port `check-quality-ratchet.mjs` + create `quality-baseline.json` | 3-4 hours | HIGH -- catches all metric regressions |
| 2 | Create `file-size-baseline.json` + port `check-file-size.mjs` | 2-3 hours | HIGH -- prevents god-components |
| 3 | Add forgotten-sibling-test check to `npm run ci` | 3-4 hours | MEDIUM -- catches test deletions |
| 4 | Consolidate rules into `AGENTS.md` SSoT | 4-6 hours | HIGH -- eliminates rule drift |
| 5 | Add `check:docs-counts` for CLAUDE.md accuracy | 1-2 hours | MEDIUM -- catches stale counts |

### Long-Term (multi-day, may require structural changes)

| # | Practice | Effort | Impact |
|---|---|---|---|
| 6 | Co-located layer AGENTS.md files with drift commands | 2-3 days | MEDIUM -- improves agent context |
| 7 | Worktree isolation + git stash ban in orchestration protocol | 1 day | HIGH for parallel agents |
| 8 | Base-green PR discipline (depends on #1) | 1-2 days | MEDIUM |
| 9 | Post-phase file-ownership verification script | 1 day | MEDIUM |
| 10 | Property-based testing for Zod schemas | 2-3 days | MEDIUM |
| 11 | Repo-root hygiene allowlist | 1 day | LOW |

---

## 5. Risk Considerations

### What to avoid

- **Do NOT copy OmniRoute's 23 hard rules verbatim** -- they are specific to OmniRoute's Electron+SQLite local-first architecture. Sophia is a Cloudflare Workers SaaS with D1. Adapt the principles, not the specifics.

- **Do NOT adopt OmniRoute's `_tasks/` private repo pattern** -- Sophia's `plans/` directory and `.orchestrate/latest/` handoff files serve the same purpose within the monorepo. The `_tasks/` pattern solves a multi-repo concern that Sophia does not have.

- **Do NOT add GitHub Actions workflows for the ratchets** -- Sophia uses CF-direct doctrine with GitHub Actions disabled by design. All gates must run from `npm run ci`, the pre-push hook, or `npm run verify`.

- **Do NOT refactor the 263 oversized files as a prerequisite for the file-size ratchet** -- the ratchet prevents *new* violations and requires frozen files to only shrink. Refactoring is a separate initiative.

- **Do NOT over-engineer the forgotten-sibling-test detection on day one** -- start with a simple path-matching heuristic (source file changed -> check that a test file exists at the expected path) before building the full import-graph analysis that OmniRoute uses.

### Assumptions

| Assumption | Confidence | What would change the answer |
|---|---|---|
| The 99 scripts in `apps/sophia-ai-factory/scripts/` include some that are unused or duplicated | HIGH | If an audit shows all 99 are actively used, repo-root hygiene is more urgent |
| The pre-push hook is actually run by developers (not routinely bypassed with `--no-verify`) | MEDIUM | If bypasses are common, the hooks provide false assurance and the CI gates become more important |
| Vitest is not currently run with any retry flags | HIGH | If retry flags exist in vitest.config.ts, the test retry policy gap is more urgent |
| The existing `check-layer-boundaries.sh` runs in CI (via `ci:boundaries`) | HIGH (verified in package.json) | If it does not actually run in CI, layer boundary enforcement is weaker than stated |
| The `deploy-2-guard.yml` and `quality-gate.yml` workflows are active (not disabled) | MEDIUM | If they are disabled, the only quality enforcement is the pre-push hook |

---

## Appendix A: Sophia Current-State Evidence (Verified 2026-08-15)

| Metric | Value | Source |
|---|---|---|
| TypeScript strict mode | `true` | `tsconfig.json` |
| Vitest global coverage threshold | lines: 60%, branches: 45% | `vitest.config.ts` |
| Dashboard coverage threshold | lines: 5%, branches: 5% | `vitest.config.ts` |
| Critical domain coverage threshold | lines: 75%, branches: 65% | `vitest.config.ts` |
| ESLint max-warnings | 341 | `package.json` ci:lint script |
| eslint-disable occurrences in src/ | 21 | grep count |
| Test files | 667 | `find src/ -name '*.test.*'` |
| Approximate test function calls | ~7,414 | `grep -rc 'it(\|test(' src/` |
| Production files over 200 lines | 263 | `wc -l` filtered |
| Scripts in `scripts/` directory | 99 | `ls scripts/ \| wc -l` |
| Agent definitions (`.claude/agents/`) | 32 .md files + 4 symlinks | `ls` |
| C-level agents (`.sophia-factory/agents/`) | 6 agents (ceo, cmo, coo, cso, cto, marketing-team) | `ls` |
| CLAUDE.md total lines | 443 (175 + 268) | `wc -l` |
| `.claude/rules/` files | 17 files | `ls` |
| GitHub workflow files | 17 (13 active, 3 disabled, 1 .md) | `ls .github/workflows/` |
| Pre-push hook gates | G0-G7 (8 gates) | `.husky/pre-push` |
| Quality baseline JSON files | 0 in app directory | `find` |
| Layer boundary enforcement | `check-layer-boundaries.sh` in CI + pre-push | verified in `ci` script |
| External HTTP circuit breaker | Documented requirement in CLAUDE.md | quality gates |
| Canonical imports | 4 (auth, db, tier, tier config) | CLAUDE.md |
| Banned imports | 4 (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`) | CLAUDE.md |

## Appendix B: OmniRoute Infrastructure Inventory (Verified 2026-08-15)

| Metric | Value | Source |
|---|---|---|
| AGENTS.md files | 3 (root + `src/lib/db/` + `open-sse/services/`) | `find -name "AGENTS.md"` |
| Root AGENTS.md lines | 712 | `wc -l` |
| CLAUDE.md lines | 55 | full text read |
| GEMINI.md lines | 14 | full text read |
| Hard Rules | 23 | AGENTS.md |
| Quality scripts (`scripts/quality/`) | 13 | `ls` |
| Check scripts (`scripts/check/`) | 69 | `ls` |
| CI workflows | 24 | `ls .github/workflows/` |
| Baseline/allowlist JSON files | 16 | `config/quality/` |
| DB domain modules | 95 | `src/lib/db/AGENTS.md` |
| Service modules | 134 | `open-sse/services/AGENTS.md` |
| Routing strategies | 17 | `open-sse/services/AGENTS.md` |
| Agent definitions shipped | 0 | confirmed: no `.claude/agents/`, no agent .md files |
| Ratchet engine | 1 (generic, multi-metric, portable) | `check-quality-ratchet.mjs` source read |
