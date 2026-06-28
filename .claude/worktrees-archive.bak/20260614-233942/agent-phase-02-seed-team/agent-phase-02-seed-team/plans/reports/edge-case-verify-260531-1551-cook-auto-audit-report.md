# Edge Case Verification Report — cook-auto Workflow

**Date:** 2026-05-31 | **Scope:** `/cook-auto` (cook skill + auto-fast + auto-parallel commands) | **Reviewers:** 5 parallel code-reviewer agents

---

## Summary

| Category | Total | ✅ Handled | ⚠️ Partial | ❌ Unhandled |
|----------|-------|-----------|-----------|-------------|
| Hard Gates Enforcement | 5 | 1 | 3 | 1 |
| Workflow Step Execution | 5 | 2 | 2 | 1 |
| Subagent Delegation & Finalize | 5 | 1 | 2 | 2 |
| Artifact & Hook Gates | 5 | 1 | 3 | 1 |
| Config, State & TDD | 5 | 1 | 2 | 2 |
| **TOTAL** | **25** | **6** | **12** | **7** |

---

## Unhandled Edge Cases (Need Fix)

| # | Edge Case | Category | Severity | Details |
|---|-----------|----------|----------|---------|
| 1 | Auto mode + side effect detected = deadlock | Hard Gates | **HIGH** | HARD-GATE-NO-SIDE-EFFECTS says "escalate to user via AskUserQuestion" but auto mode has no user to answer. Workflow hangs forever. Contradiction between `--auto` and HARD-GATE escalation. |
| 2 | code-reviewer timeout / no result | Workflow Steps | **HIGH** | Step 5 has no timeout on code-reviewer subagent. If reviewer hangs or returns empty output, auto-approve never fires (needs review-decision.json) and workflow stalls silently. No escalation path. |
| 3 | review-decision.json stale from previous run | Artifact Gates | **HIGH** | Validator checks schema validity only — no timestamp, no mtime, no run-ID. Stale PASS from previous workflow would be accepted as valid. |
| 4 | Secret scan false positives on config refs | Workflow Steps | **MEDIUM** | Grep pattern `API_KEY|api_key|token|password|secret` matches `process.env.API_KEY`, type definitions, test fixtures. No context-aware filtering. Mitigated by human gate but creates friction. |
| 5 | TDD + --auto, user unavailable timeout | Config/TDD | **HIGH** | TDD failure → HIGH-RISK → AskUserQuestion. But `--auto` has no user. No timeout, no abort policy. Deadlock on first TDD failure in unattended CI. |
| 6 | Token budget exhaustion | Config/TDD | **MEDIUM** | Zero token budget tracking anywhere in cook skill. Long workflows with parallel subagents can silently truncate. |
| 7 | Commit without user approval in auto mode | Finalize | **HIGH** | `SKILL.md:216` says "Ask user" but `workflow-steps.md:287` git-manager prompt says "stage and commit" — contradiction. Risk-gate.json validation missing before spawn. |

---

## Partial Handling (Need Improvement)

| # | Edge Case | Category | Issue |
|---|-----------|----------|-------|
| 8 | User override "just code it" | Hard Gates | No detection/logging mechanism. Workflow diagram has no override branch. User says "skip planning" but workflow still produces plan. |
| 9 | Vague AskUserQuestion answers | Hard Gates | No retry loop, no validation of answer quality. Auto mode + AskUserQuestion = undefined behavior (hang or silent proceed). |
| 10 | File-ownership overlap, no resolution | Hard Gates | Fallback only for "can't validate", NOT for "overlap detected but unresolved". |
| 11 | `.ck.json` missing/invalid | Config | Defaults documented but no explicit error handling. Simplify thresholds attempt read with no fallback. |
| 12 | Test delegation: no timeout | Workflow Steps | Tester/debugger have no timeout. Debugger loop has no cycle limit. |
| 13 | Auto-fix cycle exhaustion | Workflow Steps | 3-cycle cap exists but success/failure criteria undefined. No escalation mechanism shown in auto-mode context. |
| 14 | project-management skill fail | Finalize | Fallback only for `ck` unavailable. No error handling for timeout, crash, wrong output format. |
| 15 | Sync-back missing phase files | Finalize | Has "unresolved mappings" concept but no defined behavior (block vs log-and-continue). |
| 16 | Lint command not found | Finalize | Silent skip of MANDATORY lint gate. No error, no user notification. |
| 17 | Artifact gate: fail-open on error | Artifact Gates | Hook exits 0 on any error. Broken validator = silently passes. |
| 18 | Artifact validator: soft stages | Artifact Gates | Missing artifacts on finalize/commit stages = warning only, not block. |

---

## Already Handled

| # | Edge Case | How |
|---|-----------|-----|
| A | Scout-first skip for plan path | Mermaid diagram shows `Has plan? → Yes → Load Plan`. Skip logic consistent. |
| B | cook-after-plan-reminder silent fail | Fail-open by design. Informational only, low impact. |
| C | Working directory mismatch | Git diff post-merge verification provides indirect safety net. Low risk in practice. |
| D | Simplify gate: `git diff --numstat` | awk handles empty diff correctly, all metrics default to 0. |
| E | Test fallback to `/ck:test` | Explicitly defined in workflow-steps.md lines 5-10. |
| F | Auto-approve gate (3 conditions) | Requires PASS + artifact valid + !autoStopRequired. Score-only does NOT auto-approve. |

---

## Recommendations (Priority Order)

1. **EC #1 — Auto mode deadlock**: Add `CK_AUTO_TIMEOUT` env var or `--auto-timeout` flag. If no user response within N minutes → abort + revert.
2. **EC #2 — Reviewer timeout**: Add 5-minute timeout to code-reviewer subagent. On timeout/missing artifact → escalate to user.
3. **EC #3 — Stale review-decision.json**: Add `runId` or timestamp field to schema. Validator rejects artifacts older than current session.
4. **EC #7 — Commit approval contradiction**: Clarify SKILL.md vs workflow-steps.md. Auto mode should NOT silently commit — add explicit approval gate.
5. **EC #5 — TDD + auto timeout**: Same fix as #1. Add timeout + abort policy for all AskUserQuestion escalations in auto mode.
6. **EC #4 — Secret scan false positives**: Add `--exclude-dir=node_modules,*.test.*,*.spec.*` and context-aware filter (`process.env.` prefix exclusion).
7. **EC #6 — Token budget**: Add `contextRemaining` check before spawning parallel agents. Warn at 50%, abort at 20%.

---

## Unresolved Questions

1. Auto mode — should it be allowed to call AskUserQuestion at all, or should all escalation paths use a different mechanism (webhook, file-based signal, timeout)?
2. `risk-gate.json` operator precedence bug (validator.cjs lines 114-122) — was `||` intentional or bug?
3. `.ck.json` — should missing config use documented defaults programmatically, or should workflow fail-fast with clear error?
4. Is `workflow-artifacts.md` intended to exist at `_shared/references/` or was the reference path never updated?
