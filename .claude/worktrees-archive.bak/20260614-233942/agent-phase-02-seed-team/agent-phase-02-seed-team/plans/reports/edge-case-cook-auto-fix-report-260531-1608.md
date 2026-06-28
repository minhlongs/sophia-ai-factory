# Edge Case Fix Report — cook-auto Workflow

**Date:** 2026-05-31 | **Scope:** deep next /cook-auto | **Status:** ALL 9 FIXED

---

## Fixes Applied

| # | Edge Case | Severity | Fix Applied |
|---|-----------|----------|-------------|
| 1 | `review-decision.json` stale | 🔴 High | Added freshness check — validate `runId`/`createdAt` matches current session |
| 2 | Code-reviewer timeout/empty result | 🔴 High | Added 5-min timeout guard + empty result guard — never auto-approve on timeout |
| 3 | Auto mode + AskUserQuestion deadlock | 🔴 High | Added 2-min timeout → default revert+abort. Auto mode MUST NOT hang |
| 4 | Lint command not found | 🟡 Medium | Added explicit STOP + user report when lint command unavailable |
| 5 | Secret scan false positives | 🟢 Low | Added context exclusions: `.test.ts`, `__tests__/`, `fixtures/`, `mocks/`, `.d.ts` |
| 6 | `.ck.json` missing | 🟡 Medium | Parallel: fallback to hardware detection. Simplify: use defaults. Both log fallback |
| 7 | Auto commit contradiction | 🟡 Medium | git-manager prompt: auto-commit in --auto mode, ask user in other modes |
| 8 | Debugger loop no cycle limit | 🟡 Medium | Added max 3 cycles cap, escalate to user if unfixable |
| 9 | TDD + --auto no timeout | 🔴 High | Added `CK_AUTO_RESPONSE_TIMEOUT` (default 120s) → revert+abort on timeout |

---

## Files Modified

- `~/.claude/skills/cook/SKILL.md` — Fix 9 (TDD + --auto timeout)
- `~/.claude/skills/cook/references/workflow-steps.md` — Fixes 1-8

## Unresolved Questions

1. `risk-gate.json` operator precedence bug (`||` vs `&&`) in validator.cjs — needs code review, not just doc fix
2. `workflow-artifacts.md` exists at expected path — previous review was wrong about missing file
3. `CK_SESSION_ID` hook dependency — if unset, plan reminder shows generic fallback path
