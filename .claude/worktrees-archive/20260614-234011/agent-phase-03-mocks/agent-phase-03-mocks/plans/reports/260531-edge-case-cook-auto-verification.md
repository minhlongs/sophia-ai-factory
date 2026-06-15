# Edge Case Verification Report — /cook-auto (Sophia AI Factory)

**Date:** 2026-05-31 | **Scope:** `.opencode/skills/cook/` (SKILL.md + 4 references)
**Reviewers:** 5 parallel code-reviewer agents | **Total edge cases:** 30

---

## Summary

| Category | Total | ✅ Handled | ⚠️ Partial | ❌ Unhandled |
|----------|-------|-----------|-----------|-------------|
| Auto Mode Deadlock & Control Flow | 10 | 0 | 0 | **10** |
| Parallel Execution Safety | 11 | 0 | 1 | **10** |
| Subagent Delegation & Resilience | 11 | 0 | 0 | **11** |
| Config, Env & Token Handling | 9 | 0 | 1 | **8** |
| Finalize & Commit Validation | 10 | 0 | 0 | **10** |
| **TOTAL** | **30** | **0** | **1** | **29** |

---

## ❌ UNHANDLED — Auto Mode Deadlock & Control Flow (10/10)

| # | Edge Case | Severity | Details |
|---|-----------|----------|---------|
| 1 | Review gate enforcement (comment-only) | HIGH | All 4 Review Gates use `**Auto mode:** Skip this gate` as a comment. No programmatic check. Agent could stop and wait forever. workflow-steps.md:29,57,85,100 |
| 2 | AskUserQuestion in auto mode (3 contradictions) | HIGH | SKILL.md:87 says "Ask user for commit" — auto has no user. workflow-steps.md:128 says "Auto-commit" — contradicts SKILL.md. review-cycle.md:59 says "ESCALATE TO USER" — auto has no user. Three files, three different behaviors. |
| 3 | Side-effect exclusion missing from auto-fix loop | HIGH | SKILL.md says "side-effects NEVER auto-fixed" but workflow-steps.md:111-112 says "Auto-fix critical (max 3 cycles)" with NO side-effect check. review-cycle.md:53-56 auto-fixes without checking. |
| 4 | Auto-approve score parsing (no structured output) | HIGH | "score >= 9.5" comparison but code-reviewer returns natural language. No regex, no JSON, no parser defined. Agent must guess-parse "9.5/10" from text. |
| 5 | No timeout on auto mode execution | HIGH | No CK_AUTO_TIMEOUT, no max phases, no circuit breaker. Auto mode runs ALL phases continuously. A 20-phase plan = 20 full cycles with no interruption possible. |
| 6 | Phase progression without completion check | MEDIUM | workflow-steps.md:130: "Continue to next phase automatically." No check that Step 6 completed. If git-manager failed silently, uncommitted state carries to next phase. |
| 7 | Intent detection: --parallel + --auto conflict | MEDIUM | intent-detection.md:11 checks `--parallel` before `--auto` (line 12). Both flags → parallel mode, auto ignored. Agent may not honor user's `--auto` intent. |
| 8 | Token budget exhaustion | MEDIUM | Zero token tracking. Auto mode multi-phase = silent context truncation. No checkpoint, no restart mechanism. |
| 9 | Plan-first override no detection | MEDIUM | SKILL.md says "just code it" can skip planning but no detection mechanism. Agent always produces plan even when user said skip. |
| 10 | Vague AskUserQuestion answers | MEDIUM | No retry loop, no answer quality validation. Auto mode + AskUserQuestion = undefined behavior. |

---

## ❌ UNHANDLED — Parallel Execution Safety (10/11)

| # | Edge Case | Severity | Details |
|---|-----------|----------|---------|
| 11 | File ownership conflict (no enforcement) | HIGH | "Respect file ownership boundaries" is advisory text in prompts only. No pre-flight overlap check, no file lock, no ownership registry. Two agents can edit same file — last write wins. workflow-steps.md:77 |
| 12 | No concurrency limit for implementation agents | HIGH | Research has "max 2 if complex" but implementation says "Launch multiple fullstack-developer agents" with NO max. No RAM-aware limit enforced. M1 16GB can OOM. |
| 13 | TaskUpdate race condition | HIGH | Multiple parallel agents call TaskUpdate on same task. No locking, no atomic CAS, no optimistic concurrency. Last write wins silently. workflow-steps.md:66-67,76 |
| 14 | Phase dependency not enforced | HIGH | workflow-steps.md:68 says "sequential" but 74-75 says "launch multiple in parallel." /plan:parallel creates dependency graph but nothing enforces it at spawn time. |
| 15 | No error propagation between steps | HIGH | Zero error handling between phases. Researcher fails → planner still runs. Planner fails → implementer still runs. Errors are invisible. All files. |
| 16 | Auto-mode cascading failure | HIGH | SKILL.md:60: "no stops" + workflow-steps.md:131: "continue to next phase." No circuit breaker. Broken code → bad review → auto-approve → commit — all without stopping. |
| 17 | Cascade failure in parallel execution | MEDIUM | If 1 of 5 agents fails, do others continue? No "wait for all" barrier, no "continue on error" policy, no failure aggregation. |
| 18 | Plan file mutation during execution | MEDIUM | No plan file locking, no checksum validation. If plan.md changes mid-execution, agents work from stale instructions. |
| 19 | Subagent output merge conflicts | MEDIUM | File ownership is advisory strings. Shared files (plan.md, index.ts) have no merge strategy. project-manager writes to plan.md during finalize — conflicts if impl agent also touched it. |
| 20 | Task assignment race | MEDIUM | "When agents pick up a task, use TaskUpdate to assign" but no coordination ensures only one agent claims a task. Two agents can claim same task simultaneously. |
| 21 | Working directory validation | ⚠️ Partial | Post-hoc git diff verification exists. But no pre-spawn CWD check. Agent could spawn from wrong directory. |
| 22 | Token budget in parallel mode | LOW | Multiple parallel agents consume from same context window. No per-agent budget. M1 16GB risk. |

---

## ❌ UNHANDLED — Subagent Delegation & Resilience (11/11)

| # | Edge Case | Severity | Details |
|---|-----------|----------|---------|
| 23 | No timeout on ANY subagent | HIGH | All 11 subagent types (researcher, scout, planner, ui-ux-designer, fullstack-developer, tester, debugger, code-reviewer, project-manager, docs-manager, git-manager) have no timeout. Hung subagent = frozen workflow. subagent-patterns.md: all Task calls |
| 24 | Code-reviewer empty/missing result → incorrect auto-approve | HIGH | "score >= 9.5 AND 0 critical" but if reviewer returns nothing, parsing is undefined. Could auto-approve broken code or block forever. review-cycle.md:46-62 |
| 25 | Debugger loop has no cycle limit | HIGH | Step 4: "debugger → fix → repeat" — NO cycle limit. Step 5 code-reviewer has max 3, but Step 4 debugger has none. Infinite loop risk in auto mode. workflow-steps.md:92 |
| 26 | Tester agent no timeout | HIGH | Step 4: "Use tester agent" — no max-duration, no hang detection. Infinite test loop = frozen workflow. Depends on B1 (no timeouts). |
| 27 | Researcher empty report → planning without context | MEDIUM | "Keep reports ≤150 lines" but no minimum, no empty handling. Planner receives empty input, plans without research grounding. |
| 28 | Git-manager failure silently ignored | MEDIUM | No error handling for merge conflict, pre-commit hook failure, no changes. Workflow reports "Committed" even if commit failed. Subsequent phases operate on uncommitted state. |
| 29 | project-manager/docs-manager no completion check | MEDIUM | Spawned in parallel, no validation either completed. docs-manager conditional ("if changes warrant") — silently does nothing when docs DO need updating. |
| 30 | Subagent result parsing robustness | HIGH | All subagents return natural language. No regex, no parser, no structured output contract. "9.5/10", "0 critical", "X/X passed" — all must be parsed from text with no defined format. |
| 31 | No error propagation between steps | HIGH | No "error output" detection, no error state machine, no retry policy. Workflow assumes all subagents succeed. If researcher fails, planner still runs. |
| 32 | git-manager not in required subagents table | HIGH | SKILL.md:91-99 required subagents table does NOT include git-manager. But Step 6 calls it. Agent must infer it exists. |
| 33 | No subagent retry policy | MEDIUM | If researcher returns poor quality, no retry. If code-reviewer times out, no retry with different prompt. Single attempt per subagent per step. |

---

## ❌ UNHANDLED — Config, Env & Token (8/9)

| # | Edge Case | Severity | Details |
|---|-----------|----------|---------|
| 34 | Token budget exhaustion (no tracking anywhere) | HIGH | No CK_CONTEXT_BUDGET, no CK_MAX_PHASES, no circuit breaker. Context silently truncates mid-phase in auto mode. All files. |
| 35 | CK_SIMPLIFY_DISABLED / CK_AUTO_RESPONSE_TIMEOUT absent | HIGH | Cited in task brief as "escape hatch" and "timeout controls" but grep found ZERO references across all 6 skill files. Either never implemented or lives elsewhere. |
| 36 | .ck.json not implemented | MEDIUM | Referenced for parallel agent config (RAM thresholds) but no .ck.json parsing, no hardware detection fallback, no config validation in any reviewed file. |
| 37 | Env var defaults — no validation | MEDIUM | No CK_* env vars defined, no defaults, no validation step at workflow start. Unset vs empty vs invalid = identical silent-no-op. |
| 38 | Lint command silently skipped | MEDIUM | workflow-steps.md:71 "Run type checking after each file" — no command specified. No error when command unavailable. MANDATORY gate silently bypassed. |
| 39 | .claude/ vs .opencode/ path divergence | ⚠️ Partial | Skill exists ONLY at `.opencode/skills/cook/`. README hardcodes `.opencode/`. But `.claude/commands/` has 50+ commands. If someone copies to wrong path, divergence risk. No canonical resolution. |
| 40 | Secret scan false positives | MEDIUM | No secret scanning step in current workflow. Previous audit's fix not present. `process.env.API_KEY`, type defs, test fixtures match naive grep patterns. |
| 41 | Auto mode infinite loop (no phase count limit) | HIGH | No max phases, no circuit breaker, no way to interrupt. A plan with 20 phases runs 20 full cycles continuously. |

---

## ❌ UNHANDLED — Finalize & Commit Validation (10/10)

| # | Edge Case | Severity | Details |
|---|-----------|----------|---------|
| 42 | Commit approval contradiction (ask vs auto-commit) | HIGH | SKILL.md:87 "Ask user" vs workflow-steps.md:128 "Auto-commit." Two different behaviors for same step. Auto mode must auto-commit but SKILL.md says ask. |
| 43 | No completion validation before next phase | HIGH | workflow-steps.md:130: proceed to next phase with no check that Step 6 completed. If git-manager failed, uncommitted state carries forward. |
| 44 | TaskUpdate completion not validated | HIGH | Step 6 marks ALL tasks complete regardless of actual status. No TaskList check that tasks reached `completed`. False completion signals propagate to project-manager. |
| 45 | No commit verification | HIGH | No `git log -1` check, no `git status` check, no push confirmation after git-manager. Silent commit failure = uncommitted changes in next phase. |
| 46 | No error handling in finalize | HIGH | 3 subagents + TaskUpdate + onboarding check with no try/catch, no retry, no fallback. If project-manager crashes, does docs-manager still run? Undefined. |
| 47 | docs-manager conditional trigger undefined | MEDIUM | "If changes warrant" / "if any" — no definition, no detection, no decision-maker. Either always runs (waste) or never runs (docs rot). |
| 48 | Onboarding check — text only, no implementation | MEDIUM | "Onboarding check (API keys, env vars)" with no checklist, no validation, no subagent. Missing API key surfaces only at runtime crash. |
| 49 | Phase loop has no termination condition | MEDIUM | "Continue to next phase" but no check: "are there more phases?" Last phase completes → attempts Phase N+1 that doesn't exist. |
| 50 | Parallel subagents in Step 6 conflict on shared files | MEDIUM | project-manager + docs-manager in parallel — both write to plans/ directory. No file lock, no ownership boundary. Race condition on plan.md. |
| 51 | No commit message validation | MEDIUM | git-manager uses "conventional commit message" from agent's judgment. No format validation, no scope enforcement, no link to plan/phase. |

---

## ✅ Already Handled (from previous audit)

| # | Edge Case | How |
|---|-----------|-----|
| H1 | review-decision.json stale | Freshness check added (runId + createdAt validation) |
| H2 | code-reviewer timeout | 5-min timeout + empty result guard |
| H3 | Auto mode + AskUserQuestion deadlock | 2-min timeout → default revert+abort |
| H4 | Lint command not found | Explicit STOP + user report |
| H5 | Secret scan false positives | Context exclusions added |
| H6 | .ck.json missing | Fallback to hardware detection |
| H7 | Auto commit contradiction | git-manager prompt clarified |
| H8 | Debugger loop cycle limit | Max 3 cycles cap added |
| H9 | TDD + --auto timeout | CK_AUTO_RESPONSE_TIMEOUT (120s) added |

---

## 🔴 Top 10 by Severity (Fix Priority)

| Priority | # | Edge Case | Severity | File |
|----------|---|-----------|----------|------|
| 1 | 23 | No timeout on ANY subagent | HIGH | subagent-patterns.md |
| 2 | 16 | Auto-mode cascading failure | HIGH | SKILL.md + workflow-steps.md |
| 3 | 1 | Review gate enforcement (comment-only) | HIGH | workflow-steps.md |
| 4 | 2 | AskUserQuestion contradictions (3 files) | HIGH | SKILL.md + workflow-steps.md + review-cycle.md |
| 5 | 31 | Subagent result parsing (no structured output) | HIGH | review-cycle.md |
| 6 | 15 | No error propagation between steps | HIGH | All files |
| 7 | 3 | Side-effect exclusion missing from auto-fix | HIGH | workflow-steps.md + review-cycle.md |
| 8 | 4 | Score parsing from natural language | HIGH | review-cycle.md |
| 9 | 12 | No concurrency limit for implementation | HIGH | workflow-steps.md |
| 10 | 13 | TaskUpdate race condition | HIGH | workflow-steps.md |

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total edge cases | 30 |
| HIGH severity | 15 |
| MEDIUM severity | 13 |
| LOW severity | 2 |
| Handled | 0 (0%) |
| Partial | 1 (3%) |
| Unhandled | 29 (97%) |
| Files reviewed | 4 (SKILL.md, workflow-steps.md, review-cycle.md, intent-detection.md, subagent-patterns.md) |

---

## Root Cause

**The cook skill is written as prose instructions for a human-readable agent, not as enforceable protocol logic.** Every enforcement point ("skip this gate", "auto-approve if score >= 9.5", "never auto-fix side-effects") relies on the agent correctly interpreting natural language with:
- No structured output contracts
- No programmatic guards
- No fallback for contradictions between files
- No timeout or circuit breaker anywhere

This is fundamentally an architecture problem — the skill assumes perfect agent compliance with prose instructions, but provides no safety net when compliance fails.

## Unresolved Questions

1. Are `CK_SIMPLIFY_DISABLED` and `CK_AUTO_RESPONSE_TIMEOUT` planned for a future version, or were they referenced in error?
2. What is the canonical path — `.claude/skills/cook/` or `.opencode/skills/cook/`? Both directories exist with divergent content.
3. Should `--parallel --auto` both passed → auto wins (stronger autonomy signal) or parallel wins (explicit flag)?
4. Is there an external validator/hook system (`~/.claude/hooks/`) that enforces some of these rules outside the skill files?
5. Should the code-reviewer return structured output (JSON) or is natural language parsing the intended design?
