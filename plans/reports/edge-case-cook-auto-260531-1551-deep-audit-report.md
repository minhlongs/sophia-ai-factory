# Edge Case Verification Report — cook-auto Workflow

**Date:** 2026-05-31 | **Scope:** deep next /cook-auto | **Reviewers:** 6 parallel agents

---

## Summary

| Status | Count |
|--------|-------|
| Total edge cases reviewed | 30 |
| Handled | 7 |
| Partial | 14 |
| Unhandled | 9 |

---

## Unhandled Edge Cases (Need Fix)

| # | Edge Case | Location | Severity | Description |
|---|-----------|----------|----------|-------------|
| 1 | `review-decision.json` stale | workflow-steps.md:225 | **High** | No freshness check — stale PASS from previous run accepted |
| 2 | Code-reviewer timeout/empty result | workflow-steps.md:211-241 | **High** | No timeout on subagent; no handling for empty/missing review result |
| 3 | Auto mode + side-effect = deadlock | SKILL.md:226 + workflow-steps.md:99-108 | **High** | Auto mode escalates to AskUserQuestion but has no user — workflow hangs forever |
| 4 | TDD + --auto, user unavailable | SKILL.md:39-42 | **High** | No timeout on AskUserQuestion for TDD failure in --auto mode |
| 5 | Lint command not found | workflow-steps.md:276-278 | **Medium** | Silent skip of MANDATORY lint gate — no error, no user notification |
| 6 | Token budget exhaustion | All files | **Medium** | Zero token budget tracking — context window fills silently |
| 7 | `.ck.json` missing/invalid | workflow-steps.md:138-160 | **Medium** | No explicit fallback for missing config — simplify thresholds may error |
| 8 | Auto commit without approval | workflow-steps.md:287 vs SKILL.md:216 | **Medium** | SKILL.md says "ask user" but git-manager prompt says "stage and commit" — contradictory |
| 9 | Secret scan false positives | workflow-steps.md:282 | **Low** | No context-aware filtering — `process.env.API_KEY` treated as secret |

---

## Partial Handling (Need Improvement)

| # | Edge Case | Location | Issue |
|---|-----------|----------|-------|
| 1 | Artifact gate hook path mismatch | workflow-steps.md:239 | Hook lives at `~/.claude/hooks/` but referenced as `claude/hooks/` (project-relative) |
| 2 | Artifact gate fail-open | hook code:113-117 | Catch-all exits 0 on any error — silently passes when broken |
| 3 | Artifact validator no enforcement | workflow-steps.md:235-240 | No mechanism ensures artifacts written before gate runs |
| 4 | Artifact validator soft stages | validator.cjs:163-165 | Missing artifacts on finalize/commit only warn, not block |
| 5 | risk-gate.json missing | workflow-steps.md:242 | Only blocks in auto mode; soft stages warn only |
| 6 | risk-gate.json operator precedence | validator.cjs:114-122 | `||` vs `&&` may cause unexpected blocking in non-auto modes |
| 7 | Plan-first override no detection | SKILL.md:51-56 | "just code it" override has no detection/logging mechanism |
| 8 | Exact-requirements vague answers | SKILL.md:69-79 | No validation/retry for vague AskUserQuestion answers |
| 9 | No-side-effects no timeout | SKILL.md:88-109 | No default behavior when user doesn't respond |
| 10 | File-ownership overlap unresolved | workflow-steps.md:126-134 | Fallback only for "can't validate", not "overlap detected but unresolved" |
| 11 | Test delegation no timeout | workflow-steps.md:196-202 | No duration cap — test suite hangs = workflow hangs |
| 12 | Debugger loop no cycle limit | workflow-steps.md:199 | "fix → repeat" unbounded unlike Step 5's max-3-cycles |
| 13 | Auto-fix cycle criteria undefined | workflow-steps.md:226 | What defines "failed cycle" not specified |
| 14 | TDD Step 3.T no baseline run | workflow-steps.md:99-103 | Doesn't run existing tests before writing new ones |
| 15 | docs-manager no completion check | SKILL.md:214 + workflow-steps.md:249 | No validation it ran; vague prompt "if changes warrant" |
| 16 | sync-back missing phase files | workflow-steps.md:269-272 | No behavior defined for missing phase files or unresolvable mappings |
| 17 | Working directory no validation | workflow-steps.md:119-135 | No CWD check before spawning parallel agents |
| 18 | project-management skill no error handling | SKILL.md:213 + workflow-steps.md:247 | Fallback only for `ck` unavailable, no handling for execution errors |

---

## Handled Edge Cases

| # | Edge Case | How Handled |
|---|-----------|-------------|
| 1 | Scout-first skip for plan path | SKILL.md:66 + mermaid diagram B{Has plan path?} → Yes → Load Plan |
| 2 | Cook-after-plan-reminder silent fail | Hook is informational-only, fail-open by design, low impact |
| 3 | .ck.json parallel agent RAM fallback | workflow-steps.md:139 detects M1 16GB → max 2 agents |
| 4 | CK_SIMPLIFY_DISABLED env var | workflow-steps.md:172 provides escape hatch |
| 5 | Tester fallback to /ck:test | workflow-steps.md:5-10 defines fallback for Task tool unavailability |
| 6 | Auto-fix side-effect exclusion | SKILL.md:226 + workflow-steps.md:226 — side-effects NEVER auto-fixed |
| 7 | Interruptible review cycles | review-cycle.md defines max 3 interactive cycles |

---

## Top 5 Findings (by severity)

1. **Auto mode deadlock** (EC-3) — When `--auto` detects side effects, it calls `AskUserQuestion` but auto mode has no user. Workflow hangs forever. **Fix:** Add timeout + default "revert" behavior for AskUserQuestion in auto mode.

2. **Stale review-decision.json** (EC-3) — No freshness check. Previous run's PASS accepted as current. **Fix:** Add timestamp + mtime validation in validator.

3. **Code-reviewer no timeout** (EC-2) — Subagent can hang indefinitely. **Fix:** Add 5-minute timeout + "no result → escalate" fallback.

4. **TDD + --auto no timeout** (EC-2) — Same deadlock pattern as #1. **Fix:** Add `CK_AUTO_TIMEOUT` env var or `--auto-timeout` flag.

5. **Lint gate silent skip** (EC-4) — MANDATORY gate silently bypassed when command not found. **Fix:** Add explicit error + escalation when lint command unavailable.

---

## Unresolved Questions

1. Should `risk-gate.json` operator precedence (`||` vs `&&`) be fixed or is it intentional?
2. Is `workflow-artifacts.md` supposed to be in a different location? Currently missing from expected paths.
3. How is `CK_SESSION_ID` set when Plan subagent hook fires? If unset, every run gets generic fallback message.
4. Should there be a configurable `CK_AUTO_TIMEOUT` for unattended auto-mode runs?
