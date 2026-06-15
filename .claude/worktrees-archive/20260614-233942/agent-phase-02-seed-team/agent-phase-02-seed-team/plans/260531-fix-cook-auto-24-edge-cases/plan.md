# Fix Plan: 24 Edge Cases in Cook Auto Workflow

## Overview
Fix 24 edge cases (18 unhandled, 6 partial) across 5 skill files in `/cook-auto` scope.

## Groups (parallel-safe)

### Group A: SKILL.md — Contradictions + missing contracts (2 agents)
- **A1:** Fix EC-7 (timeout contradiction) + EC-10 (agent limit) + EC-29 (git dirty-tree)
- **A2:** Add phase-status.json schema definition + partial results format

### Group B: workflow-steps.md — Undefined artifacts + guards (2 agents)
- **B1:** Fix EC-23 (token budget), EC-24 (partial save), EC-25 (docs trigger filter), EC-27 (empty plan guard)
- **B2:** Fix EC-6 (researcher retry), EC-8 (debugger global cap), EC-11 (REVIEW_RESULT retry), EC-21 (threshold validation), EC-26 (phase state tracking)

### Group C: review-cycle.md — Auto-handling cycle + structured output (2 agents)
- **C1:** Fix EC-17 (score<7 escalation), EC-18 (side-effect reporting), EC-19 (side-effect keywords), EC-22 (warning accumulation), EC-28 (phase re-run after fix)
- **C2:** Fix EC-12 (score edge cases), EC-14 (TEST_RESULT validation), EC-15 (STATUS validation), EC-16 (multiple blocks)

## Execution Strategy
- Groups A, B, C run in parallel (different files)
- Within each group, agents work on non-overlapping sections
- Sequential dependency: A2 must complete before B1 (phase-status.json schema needed by workflow-steps)
- Final: tester + code-reviewer verification

## File Ownership
| File | Groups | Agents |
|------|--------|--------|
| SKILL.md | A1, A2 | 2 fullstack-developer |
| workflow-steps.md | B1, B2 | 2 fullstack-developer |
| review-cycle.md | C1, C2 | 2 fullstack-developer |
| subagent-patterns.md | A1, B2, C2 | shared (edits coordinated) |
| intent-detection.md | none | no changes needed |
