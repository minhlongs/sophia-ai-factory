# Binh Pháp Edge Case Fixes — Master Plan
**Date:** 2026-06-07 17:17
**Target:** `.claude/commands/binh-phap.md` + `.claude/rules/` symlinks

## Overview
The `/binh-phap` command (61 lines, 4 phases: plan→implement→verify→ship) has 22 unhandled edge cases and 6 partial. This plan addresses all of them across 4 phases.

## Phase Summary
| # | Phase | Scope | Est. Effort |
|---|-------|-------|-------------|
| 1 | Command Rewrite | All 28 edge cases in single binh-phap.md rewrite | Medium |
| 2 | Symlink Recovery | 5 broken symlinks + pilot.md fix | Medium |
| 3 | State Infrastructure | State files for phase tracking + approval | Small |
| 4 | Test & Verify | Smoke tests + validation | Small |

## Dependencies
- Phase 1 is independent (command file only)
- Phase 2 is independent (rules files only)
- Phase 3 depends on Phase 1 (state file paths defined in command)
- Phase 4 depends on Phases 1-3

## Files Modified
```
.claude/commands/binh-phap.md  # Rewrite (~200 lines, up from 61)
.claude/commands/pilot.md      # Minor fix (brace expansion line 104)
~/.claude/rules/binh-phap-core.md              # NEW
~/.claude/rules/binh-phap-cicd.md              # NEW
~/.claude/rules/binh-phap-memory-practices.md  # NEW
~/.claude/rules/binh-phap-quality.md           # NEW
~/.claude/rules/binh-phap-workflow.md          # NEW
.claude/state/binh-phap-state.json             # NEW (phase tracking)
.claude/state/binh-phap-approval.json          # NEW (approval persistence)
```

## Success Criteria
- `/binh-phap` with no args shows help
- `/binh-phap invalid` shows error + usage
- `/binh-phap ship` without prior phases aborts with clear message
- All 5 symlinks resolve to real content (>100 lines each)
- State file tracks phase progress across invocations
- Approval persists for 24h
- Secret scanning blocks deploy if patterns detected
- Dirty tree check blocks implement if uncommitted changes
- Pilot.md brace expansion fixed
