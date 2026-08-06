# Phase 2: Architecture Fix — Restore 4-Layer Model

**Priority:** P0
**Effort:** 2-3 weeks
**Status:** completed
**Created:** 2026-08-05

## Overview
Fix inverted architecture so future features don't require touching 5+ files per change.

| Violation | Count | Severity | Fix Approach |
|-----------|-------|----------|--------------|
| forest→land imports | 395 | CRITICAL | Move business logic to land/, forest calls land workflows |
| tree→land imports | 227 | HIGH | Domain logic should not call workflows directly |
| D1 direct coupling | 918 files (24%) | HIGH | All data access through repositories |
| God objects | 15+ files >500 lines | MEDIUM | Break up files in wrong layers first |

## Key Insights
- forest→land is root cause of velocity death — circular deps require touching 3+ layers per change
- D1 direct coupling means schema changes require 918 file updates
- God objects in wrong layers multiply the problem

## Requirements
- [ ] Fix top 20 forest→land violations
- [ ] Fix top 15 tree→land violations
- [ ] Break up 5 largest god objects in wrong layers
- [ ] Add repository wrappers for 10 most-used D1 queries
- [ ] Verify imports follow seed → tree → forest → land direction

## Architecture
Target: land → forest → tree → seed (strict import direction)

## Implementation Steps
1. Run import analysis to identify worst offenders
2. For each violation: determine correct layer, extract code, update imports
3. Add repository methods for common D1 patterns
4. Update callers to use new repository methods

## Success Criteria
- 0 forest→land violations
- 0 tree→land violations
- <100 direct D1 accesses (down from 918)
- All tests pass
