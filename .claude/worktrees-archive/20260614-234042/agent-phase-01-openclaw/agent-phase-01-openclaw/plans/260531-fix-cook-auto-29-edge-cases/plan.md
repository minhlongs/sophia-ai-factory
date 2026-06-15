# Fix Plan — 29 Edge Cases in /cook-auto Skill
**Date:** 2026-05-31 | **Scope:** `.opencode/skills/cook/`
**Strategy:** 5 parallel fix agents, one file owner each, then merge

## Groups & File Ownership

| Group | Agent | File Owner | Fixes | Count |
|-------|-------|-----------|-------|-------|
| A | fullstack-developer | SKILL.md | Auto mode deadlock, AskUserQuestion contradictions, side-effect exclusion, auto-approve threshold, mode conflict table | 5 |
| B | fullstack-developer | workflow-steps.md | Review gate enforcement, phase validation, completion check, subagent timeouts, concurrency limits, error propagation, debugger cycle limit | 7 |
| C | fullstack-developer | review-cycle.md | Score parsing, structured output, auto-handling cycle, escalation in auto mode | 4 |
| D | fullstack-developer | workflow-steps.md + SKILL.md | Token budget, config validation, .ck.json handling, lint command check, docs-manager trigger, onboarding check | 6 |
| E | fullstack-developer | subagent-patterns.md | Subagent timeouts, result parsing contracts, error handling, retry policy | 5 |

## Dependencies
- A, B, C, D, E are ALL independent (different files or different sections) → parallel
- After all groups complete: verification pass + report

## Success Criteria
- Every edge case from verification report has a fix
- No contradictions between files
- No prose-only enforcement (every rule has a mechanism)
- `npm test` still passes (no regression in skill logic)
